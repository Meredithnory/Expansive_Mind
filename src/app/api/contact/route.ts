import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    trustedApplicationOrigin,
} from "../../lib/request-security";
import {
    contactConfirmationEmail,
    contactNotificationEmail,
} from "../../lib/contact-mail";
import { sendEmail } from "../../lib/send-email";
import {
    DEVELOPER_EMAIL,
    DEVELOPER_NAME,
    contactMailto,
    parseContactFields,
    type ContactFields,
} from "../../lib/contact";

function emailOrigin(request: NextRequest) {
    try {
        return trustedApplicationOrigin(request);
    } catch {
        return "https://expansivemind.ai";
    }
}

/**
 * Meredith's copy first. Only when that was accepted does the sender get the
 * short "we got it" reply, at most twice a day per address.
 */
async function deliver(request: NextRequest, fields: ContactFields) {
    const origin = emailOrigin(request);
    const notice = await sendEmail({
        to: DEVELOPER_EMAIL,
        replyTo: fields.email,
        ...contactNotificationEmail(fields, { origin }),
    });
    if (!notice.accepted) return false;

    const confirmLimit = await consumeRateLimit({
        scope: "contact-confirm",
        identity: fields.email,
        limit: 2,
        windowMs: 24 * 60 * 60_000,
    });
    if (confirmLimit.allowed) {
        await sendEmail({
            to: fields.email,
            ...contactConfirmationEmail(fields, { origin }),
        });
    }
    return true;
}

export async function POST(request: NextRequest) {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const rateLimit = await consumeRateLimit({
            scope: "contact",
            identity: requestIp(request),
            limit: 5,
            windowMs: 60 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: "A few notes are already on the way. Try again in a bit.",
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const data = await request.json().catch(() => ({}));
        const parsed = parseContactFields(data);
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        if (parsed.spam) {
            return NextResponse.json({ success: true, delivered: "inbox" });
        }

        const delivered = (await deliver(request, parsed.fields))
            ? "inbox"
            : "mailto";

        return NextResponse.json({
            success: true,
            delivered,
            mailto: contactMailto(parsed.fields),
            to: DEVELOPER_EMAIL,
            developer: DEVELOPER_NAME,
        });
    } catch (error) {
        console.error("Error processing contact form", error);
        return NextResponse.json(
            { error: "We couldn't send that just now. Email Meredith directly?" },
            { status: 500 },
        );
    }
}
