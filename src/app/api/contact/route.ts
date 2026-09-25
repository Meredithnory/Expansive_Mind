import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import { hasValidMutationOrigin } from "../../lib/request-security";
import {
    DEVELOPER_EMAIL,
    DEVELOPER_NAME,
    contactMailto,
    contactTextBody,
    parseContactFields,
    type ContactFields,
} from "../../lib/contact";

async function sendWithResend(fields: ContactFields) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const from =
        process.env.CONTACT_FROM_EMAIL || "Expansive Mind <beth.t@example.com>";
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [DEVELOPER_EMAIL],
            reply_to: fields.email,
            subject: `Expansive Mind — ${fields.topic}`,
            text: contactTextBody(fields),
        }),
    });

    if (!response.ok) {
        console.error("Contact email failed", response.status);
        return false;
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

        const delivered = (await sendWithResend(parsed.fields))
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
