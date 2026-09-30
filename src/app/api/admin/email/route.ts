import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import { recordAdminAction } from "../../../lib/admin-audit";
import {
    ADMIN_EMAIL_MAX_RECIPIENTS,
    adminEmailContent,
    parseAdminEmailInput,
    productEmailSettings,
    type AdminEmailAudience,
    type ProductEmailSettings,
} from "../../../lib/admin-email";
import { contactConfirmationEmail, contactNotificationEmail } from "../../../lib/contact-mail";
import {
    hasUnsubscribeSecret,
    unsubscribeToken,
    unsubscribeUrl,
} from "../../../lib/email-unsubscribe";
import { CONTACT_TOPICS, DEVELOPER_EMAIL } from "../../../lib/contact";
import {
    passwordResetHtml,
    passwordResetSubject,
} from "../../../lib/password-reset";
import { consumeRateLimit } from "../../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
    trustedApplicationOrigin,
} from "../../../lib/request-security";
import { sendEmail } from "../../../lib/send-email";
import AdminEmail from "../../../models/AdminEmail";
import User from "../../../models/User";

const DAY_MS = 24 * 60 * 60 * 1_000;

function audienceFilter(audience: Exclude<AdminEmailAudience, "one">) {
    if (audience === "pro") return { $or: [{ plan: "pro" }, { accessOverride: "pro" }] };
    if (audience === "free") return { plan: { $ne: "pro" }, accessOverride: { $ne: "pro" } };
    return { submittedAt: { $gte: new Date(Date.now() - 30 * DAY_MS) } };
}

/** Admin email accepted by Resend since midnight UTC (the provider's daily window). */
async function sentToday() {
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const [row] = await AdminEmail.aggregate<{ sent: number }>([
        { $match: { createdAt: { $gte: midnight } } },
        { $group: { _id: null, sent: { $sum: "$sent" } } },
    ]);
    return row?.sent ?? 0;
}

function complianceStatus(settings: ProductEmailSettings, sent: number) {
    return {
        postalAddressSet: Boolean(settings.postalAddress),
        postalAddress: settings.postalAddress,
        unsubscribeReady: hasUnsubscribeSecret(),
        from: settings.from,
        dailyMax: settings.dailyMax,
        sentToday: sent,
        remainingToday: Math.max(0, settings.dailyMax - sent),
    };
}

function origin(request: NextRequest) {
    try {
        return trustedApplicationOrigin(request);
    } catch {
        return "https://expansivemind.ai";
    }
}

/** Who each group reaches, what was sent, and previews of the automatic emails. */
export const GET = withAdmin(async (request: NextRequest) => {
    const groups = ["pro", "free", "new"] as const;
    const counts = await Promise.all(
        groups.map(async (audience) => {
            const filter = audienceFilter(audience);
            const [all, optedIn] = await Promise.all([
                User.countDocuments(filter),
                User.countDocuments({ ...filter, productEmailOptIn: true }),
            ]);
            return [audience, { all, optedIn }] as const;
        }),
    );
    const sent = await AdminEmail.find().sort({ createdAt: -1 }).limit(30).lean();
    const site = origin(request);
    const sample = {
        name: "[Name]",
        email: "name@example.com",
        topic: CONTACT_TOPICS[0],
        message: "[Their message]",
    };
    const notice = contactNotificationEmail(sample, { origin: site });
    const reply = contactConfirmationEmail(sample, { origin: site });
    const compliance = complianceStatus(productEmailSettings(process.env), await sentToday());
    return NextResponse.json(
        {
            audiences: Object.fromEntries(counts),
            compliance,
            sent,
            templates: [
                {
                    id: "password-reset",
                    name: "Password reset",
                    trigger: "When someone asks, or when you send one from People",
                    subject: passwordResetSubject(),
                    html: passwordResetHtml(`${site}/reset-password?token=preview`),
                },
                {
                    id: "contact-notice",
                    name: "Contact message to you",
                    trigger: "Every message from the Contact page",
                    subject: notice.subject,
                    html: notice.html,
                },
                {
                    id: "contact-reply",
                    name: "“We got your message”",
                    trigger: "Sent to the person who wrote in",
                    subject: reply.subject,
                    html: reply.html,
                },
            ],
            maxRecipients: ADMIN_EMAIL_MAX_RECIPIENTS,
            configured: Boolean(process.env.RESEND_API_KEY),
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});

type Recipient = { _id: unknown; email: string };

export const POST = withAdmin(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json(
            { error: "Email isn't set up (RESEND_API_KEY is missing)." },
            { status: 503 },
        );
    }
    const limit = await consumeRateLimit({
        scope: "admin-email",
        identity: request.user._id.toString(),
        limit: 20,
        windowMs: 60 * 60_000,
    });
    if (!limit.allowed) {
        return NextResponse.json({ error: "That's a lot of email in an hour. Try again later." }, { status: 429 });
    }
    const body = await readLimitedJsonBody(request, 32 * 1024);
    if (!body.ok) {
        return NextResponse.json({ error: "A valid message is required." }, { status: body.status });
    }
    const parsed = parseAdminEmailInput(body.value);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.value;
    const group = input.audience !== "one";
    const settings = productEmailSettings(process.env);

    // Group email (tests included, so the preview is the real thing) needs a
    // mailing address and a working unsubscribe link before it can go out.
    if (group && !settings.postalAddress) {
        return NextResponse.json(
            { error: "Add a mailing address (EMAIL_POSTAL_ADDRESS) before sending group email. The law requires one in every product email." },
            { status: 400 },
        );
    }
    if (group && !hasUnsubscribeSecret()) {
        return NextResponse.json(
            { error: "Unsubscribe links aren't set up (EMAIL_UNSUBSCRIBE_SECRET is missing)." },
            { status: 503 },
        );
    }

    let recipients: Recipient[];
    if (input.test) {
        recipients = [{ _id: request.user._id, email: request.user.email }];
    } else if (input.audience === "one") {
        const person = await User.findById(input.userId).select("email").lean<Recipient | null>();
        if (!person) return NextResponse.json({ error: "That person wasn't found." }, { status: 404 });
        recipients = [person];
    } else {
        // Opted-in only, always. An unsubscribe turns this off.
        const filter = { ...audienceFilter(input.audience), productEmailOptIn: true };
        recipients = await User.find(filter)
            .select("email")
            .limit(ADMIN_EMAIL_MAX_RECIPIENTS + 1)
            .lean<Recipient[]>();
        if (recipients.length > ADMIN_EMAIL_MAX_RECIPIENTS) {
            return NextResponse.json(
                { error: `That group is over ${ADMIN_EMAIL_MAX_RECIPIENTS} people. Narrow it first.` },
                { status: 400 },
            );
        }
        if (recipients.length === 0) {
            return NextResponse.json({ error: "Nobody in that group can get this email yet." }, { status: 400 });
        }
    }

    // Resend's daily allowance is shared with password resets: stop short of it.
    const remaining = Math.max(0, settings.dailyMax - (await sentToday()));
    if (recipients.length > remaining) {
        return NextResponse.json(
            {
                error: `That's ${recipients.length} emails and ${remaining} of today's ${settings.dailyMax} are left. The count resets at midnight UTC.`,
            },
            { status: 400 },
        );
    }

    const site = origin(request);
    let sent = 0;
    let failed = 0;
    // A few at a time: fast enough for launch-sized lists, gentle on the provider.
    for (let start = 0; start < recipients.length; start += 5) {
        const batch = recipients.slice(start, start + 5);
        const results = await Promise.all(
            batch.map((person) => {
                const id = String(person._id);
                const unsubscribe = group ? unsubscribeUrl(site, id) : null;
                const content = adminEmailContent({
                    subject: input.subject,
                    body: input.body,
                    origin: site,
                    unsubscribeUrl: unsubscribe,
                    postalAddress: group ? settings.postalAddress : null,
                });
                return sendEmail({
                    to: person.email,
                    ...content,
                    // support@ has no inbox; replies reach Meredith.
                    replyTo: DEVELOPER_EMAIL,
                    ...(group ? { from: settings.from } : {}),
                    ...(unsubscribe
                        ? {
                              headers: {
                                  "List-Unsubscribe": `<${site}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(id))}>`,
                                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                              },
                          }
                        : {}),
                });
            }),
        );
        for (const result of results) {
            if (result.accepted) sent += 1;
            else failed += 1;
        }
    }

    await AdminEmail.create({
        subject: input.subject,
        body: input.body,
        audience: input.audience,
        ...(input.audience === "one" && input.userId ? { userID: input.userId } : {}),
        onlyOptedIn: group,
        test: input.test,
        recipients: recipients.length,
        sent,
        failed,
        sentBy: request.user.email,
    });
    await recordAdminAction({
        adminEmail: request.user.email,
        action: input.test ? "email.test" : "email.send",
        target: input.audience === "one" ? `user:${input.userId}` : `audience:${input.audience}`,
        after: { subject: input.subject, recipients: recipients.length, sent, failed },
    });
    return NextResponse.json({ recipients: recipients.length, sent, failed });
});
