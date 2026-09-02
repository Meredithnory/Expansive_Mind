import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../../lib/admin";
import { recordAdminAction } from "../../../../lib/admin-audit";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { getStripe } from "../../../../lib/stripe";
import type { QuotaFeature } from "../../../../lib/plan-config";
import User from "../../../../models/User";
import UsageCounter from "../../../../models/UsageCounter";

const actions = new Set([
    "grant_pro",
    "revoke_pro",
    "reset_usage",
    "cancel_subscription",
    "refund_latest",
]);
const features = new Set<QuotaFeature>([
    "search",
    "discover",
    "chat",
    "scholar_search",
    "projects",
]);

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
    };
    let result: Record<string, unknown> = {};

    if (action === "grant_pro" || action === "revoke_pro") {
        const accessOverride = action === "grant_pro" ? "pro" : null;
        await User.updateOne({ _id: user._id }, { $set: { accessOverride } });
        result = { accessOverride };
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

    await recordAdminAction({
        adminEmail: request.user.email,
        action: `user.${action}`,
        target: `user:${userId}`,
        before,
        after: result,
    });
    return NextResponse.json({ ok: true, result });
});
