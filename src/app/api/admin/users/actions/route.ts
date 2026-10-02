import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../../lib/admin";
import { recordAdminAction } from "../../../../lib/admin-audit";
import {
    hasValidMutationOrigin,
    trustedApplicationOrigin,
} from "../../../../lib/request-security";
import {
    PASSWORD_RESET_TTL_MS,
    buildPasswordResetLink,
    createPasswordResetToken,
    hashPasswordResetToken,
} from "../../../../lib/password-reset";
import { sendPasswordResetEmail } from "../../../../lib/password-reset-mail";
import { getStripe } from "../../../../lib/stripe";
import { getPlanConfig, type QuotaFeature } from "../../../../lib/plan-config";
import { DEVELOPER_EMAIL } from "../../../../lib/contact";
import { proAccessEmail } from "../../../../lib/pro-access-mail";
import { sendEmail } from "../../../../lib/send-email";
import AdminEmail from "../../../../models/AdminEmail";
import Block from "../../../../models/Block";
import Follow from "../../../../models/Follow";
import ForumComment from "../../../../models/ForumComment";
import ForumPost from "../../../../models/ForumPost";
import ForumReport from "../../../../models/ForumReport";
import Group from "../../../../models/Group";
import GroupComment from "../../../../models/GroupComment";
import GroupMember from "../../../../models/GroupMember";
import GroupPost from "../../../../models/GroupPost";
import Message from "../../../../models/Message";
import PageEngagement from "../../../../models/PageEngagement";
import PaperBrief from "../../../../models/PaperBrief";
import PaperHighlight from "../../../../models/PaperHighlight";
import PaperShare from "../../../../models/PaperShare";
import Project from "../../../../models/Project";
import SavedDiscovery from "../../../../models/SavedDiscovery";
import SavedPaper from "../../../../models/SavedPaper";
import User from "../../../../models/User";
import UsageCounter from "../../../../models/UsageCounter";
import UsageEvent from "../../../../models/UsageEvent";

const actions = new Set([
    "grant_pro",
    "revoke_pro",
    "reset_usage",
    "cancel_subscription",
    "refund_latest",
    "remove_user",
    "send_password_reset",
    "revoke_sessions",
]);
const features = new Set<QuotaFeature>([
    "search",
    "discover",
    "chat",
    "scholar_search",
    "projects",
]);

async function cancelStripeSubscription(user: {
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
}) {
    if (!user.stripeSubscriptionId) return null;
    if (!user.stripeCustomerId) {
        throw new Error("This user has a Stripe subscription without a customer id.");
    }
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
    );
    const customerId =
        typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
    if (customerId !== user.stripeCustomerId) {
        throw new Error("Stripe subscription ownership check failed.");
    }
    const canceled = await stripe.subscriptions.cancel(subscription.id);
    return {
        subscriptionId: canceled.id,
        status: canceled.status,
    };
}

export const POST = withAdmin(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "");
    const userId = String(body?.userId || "");
    if (
        !actions.has(action) ||
        body?.confirm !== action ||
        !mongoose.isValidObjectId(userId)
    ) {
        return NextResponse.json(
            { error: "A valid, confirmed support action is required." },
            { status: 400 },
        );
    }

    const user = await User.findById(userId);
    if (!user) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const before = {
        accessOverride: user.accessOverride || null,
        subscriptionStatus: user.subscriptionStatus,
        stripeSubscriptionId: user.stripeSubscriptionId,
        email: user.email,
    };
    let result: Record<string, unknown> = {};

    if (action === "grant_pro" || action === "revoke_pro") {
        const accessOverride = action === "grant_pro" ? "pro" : null;
        await User.updateOne({ _id: user._id }, { $set: { accessOverride } });
        result = { accessOverride };
        // Paid plans are hidden, so nothing on the site says what Pro
        // includes: a new grant emails them (unless the admin unticks it).
        if (
            action === "grant_pro" &&
            before.accessOverride !== "pro" &&
            body?.notify !== false &&
            user.email
        ) {
            const mail = proAccessEmail({
                origin: trustedApplicationOrigin(request),
                firstName: user.firstName,
                email: user.email,
                allowance: (await getPlanConfig()).entitlements.pro,
            });
            const sent = await sendEmail({ to: user.email, replyTo: DEVELOPER_EMAIL, ...mail });
            await AdminEmail.create({
                subject: mail.subject,
                body: mail.text,
                audience: "one",
                userID: user._id,
                onlyOptedIn: false,
                recipients: 1,
                sent: sent.accepted ? 1 : 0,
                failed: sent.accepted ? 0 : 1,
                sentBy: request.user.email,
            }).catch(() => console.error("Pro email log failed"));
            result = { ...result, emailed: sent.accepted };
        }
    }

    if (action === "reset_usage") {
        const feature = body.feature as QuotaFeature | undefined;
        if (feature && !features.has(feature)) {
            return NextResponse.json({ error: "Invalid quota feature." }, { status: 400 });
        }
        const deletion = await UsageCounter.deleteMany({
            userID: user._id,
            ...(feature ? { feature } : {}),
        });
        result = { resetFeature: feature || "all", deleted: deletion.deletedCount };
    }

    if (action === "send_password_reset") {
        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json(
                { error: "Email isn't set up, so no reset link can be sent." },
                { status: 503 },
            );
        }
        let origin: string;
        try {
            origin = trustedApplicationOrigin(request);
        } catch {
            return NextResponse.json(
                { error: "The site address isn't configured for reset links." },
                { status: 503 },
            );
        }
        // Same one-time, one-hour link as Forgot password.
        const token = createPasswordResetToken();
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    passwordResetTokenHash: hashPasswordResetToken(token),
                    passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
                },
            },
        );
        const sent = await sendPasswordResetEmail({
            to: user.email,
            link: buildPasswordResetLink(origin, token),
        });
        if (!sent.accepted) {
            await User.updateOne(
                { _id: user._id },
                { $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" } },
            );
            return NextResponse.json(
                { error: "The email service didn't accept the reset email. Try again." },
                { status: 502 },
            );
        }
        result = { resetEmailSent: true };
    }

    if (action === "revoke_sessions") {
        // Every signed-in device fails its next session check.
        await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
        result = { sessionsRevoked: true };
    }

    if (action === "cancel_subscription") {
        if (!user.stripeSubscriptionId || !user.stripeCustomerId) {
            return NextResponse.json(
                { error: "This user has no Stripe subscription." },
                { status: 409 },
            );
        }
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(
            user.stripeSubscriptionId,
        );
        const customerId =
            typeof subscription.customer === "string"
                ? subscription.customer
                : subscription.customer.id;
        if (customerId !== user.stripeCustomerId) {
            return NextResponse.json(
                { error: "Stripe subscription ownership check failed." },
                { status: 409 },
            );
        }
        const updated = await stripe.subscriptions.update(subscription.id, {
            cancel_at_period_end: true,
        });
        result = {
            subscriptionId: updated.id,
            cancelAtPeriodEnd: updated.cancel_at_period_end,
        };
    }

    if (action === "refund_latest") {
        if (!user.stripeCustomerId) {
            return NextResponse.json(
                { error: "This user has no Stripe customer." },
                { status: 409 },
            );
        }
        const stripe = getStripe();
        const charges = await stripe.charges.list({
            customer: user.stripeCustomerId,
            limit: 10,
        });
        const charge = charges.data.find(
            (candidate) => candidate.paid && !candidate.refunded,
        );
        if (!charge) {
            return NextResponse.json(
                { error: "No refundable successful charge was found." },
                { status: 409 },
            );
        }
        const customerId =
            typeof charge.customer === "string"
                ? charge.customer
                : charge.customer?.id;
        if (customerId !== user.stripeCustomerId) {
            return NextResponse.json(
                { error: "Stripe charge ownership check failed." },
                { status: 409 },
            );
        }
        const refund = await stripe.refunds.create(
            { charge: charge.id },
            { idempotencyKey: `admin-refund-${charge.id}` },
        );
        result = {
            refundId: refund.id,
            chargeId: charge.id,
            amount: refund.amount,
            status: refund.status,
        };
    }

    if (action === "remove_user") {
        if (userId === request.user._id.toString()) {
            return NextResponse.json(
                { error: "You cannot remove your own admin account." },
                { status: 409 },
            );
        }

        let stripeCancel: Record<string, unknown> | null = null;
        try {
            stripeCancel = await cancelStripeSubscription(user);
        } catch (error) {
            return NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unable to cancel Stripe subscription.",
                },
                { status: 409 },
            );
        }

        // Groups they own go away entirely; elsewhere, their posts,
        // comments, and memberships are removed.
        const ownedGroups = (await Group.find({ ownerID: user._id })
            .select("_id")
            .lean()) as unknown as Array<{ _id: unknown }>;
        const ownedGroupIds = ownedGroups.map((group) => group._id);
        const [groupComments, groupPosts, groupMemberships] = await Promise.all([
            GroupComment.deleteMany({
                $or: [{ authorID: user._id }, { groupID: { $in: ownedGroupIds } }],
            }),
            GroupPost.deleteMany({
                $or: [{ authorID: user._id }, { groupID: { $in: ownedGroupIds } }],
            }),
            GroupMember.deleteMany({
                $or: [{ userID: user._id }, { groupID: { $in: ownedGroupIds } }],
            }),
        ]);
        const groups = await Group.deleteMany({ _id: { $in: ownedGroupIds } });

        const [forumPosts, forumComments] = await Promise.all([
            ForumPost.deleteMany({ authorID: user._id }),
            ForumComment.deleteMany({ authorID: user._id }),
            Follow.deleteMany({ $or: [{ followerID: user._id }, { followeeID: user._id }] }),
            Block.deleteMany({ $or: [{ blockerID: user._id }, { blockedID: user._id }] }),
            ForumReport.deleteMany({ reporterID: user._id }),
        ]);

        const savedPapers = await SavedPaper.find({ userID: user._id })
            .select("_id")
            .lean();
        const savedPaperIds = savedPapers.map((paper) => paper._id);
        const messageDeletion =
            savedPaperIds.length > 0
                ? await Message.deleteMany({
                      savedPaperID: { $in: savedPaperIds },
                  })
                : { deletedCount: 0 };

        const [
            usageCounters,
            papers,
            projects,
            highlights,
            discoveries,
            briefs,
            shares,
            usageEvents,
            visits,
        ] = await Promise.all([
            UsageCounter.deleteMany({ userID: user._id }),
            SavedPaper.deleteMany({ userID: user._id }),
            Project.deleteMany({ userID: user._id }),
            PaperHighlight.deleteMany({ userID: user._id }),
            SavedDiscovery.deleteMany({ userID: user._id }),
            PaperBrief.deleteMany({ userID: user._id }),
            PaperShare.deleteMany({ ownerID: user._id }),
            // Keep cost and traffic totals, but cut the link to the person.
            UsageEvent.updateMany(
                { userID: user._id },
                { $unset: { userID: "" } },
            ),
            PageEngagement.updateMany(
                { userID: user._id },
                { $unset: { userID: "" } },
            ),
        ]);

        await User.deleteOne({ _id: user._id });

        result = {
            email: user.email,
            stripeCancel,
            deleted: {
                usageCounters: usageCounters.deletedCount,
                savedPapers: papers.deletedCount,
                messages: messageDeletion.deletedCount,
                projects: projects.deletedCount,
                highlights: highlights.deletedCount,
                discoveries: discoveries.deletedCount,
                briefs: briefs.deletedCount,
                shares: shares.deletedCount,
                usageEventsAnonymized: usageEvents.modifiedCount,
                visitsAnonymized: visits.modifiedCount,
                groupsOwned: groups.deletedCount,
                groupPosts: groupPosts.deletedCount,
                groupComments: groupComments.deletedCount,
                groupMemberships: groupMemberships.deletedCount,
                forumPosts: forumPosts.deletedCount,
                forumComments: forumComments.deletedCount,
                user: 1,
            },
        };
    }

    await recordAdminAction({
        adminEmail: request.user.email,
        action: `user.${action}`,
        target: `user:${userId}`,
        before,
        after: result,
    });
    return NextResponse.json({ ok: true, result });
});
