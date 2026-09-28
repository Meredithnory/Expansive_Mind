import "server-only";
import { emailFromAddress } from "./email-layout";

export type SendEmailResult = {
    accepted: boolean;
    status: number | null;
    id: string | null;
};

/** One message through Resend. Never throws; a missing key is "not accepted". */
export async function sendEmail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
}): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { accepted: false, status: null, id: null };
    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: emailFromAddress(),
                to: [input.to],
                subject: input.subject,
                text: input.text,
                html: input.html,
                ...(input.replyTo ? { reply_to: input.replyTo } : {}),
            }),
        });
        if (!response.ok) {
            console.error("Email send failed", response.status);
            return { accepted: false, status: response.status, id: null };
        }
        const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
        return {
            accepted: true,
            status: response.status,
            id: body && typeof body.id === "string" ? body.id : null,
        };
    } catch {
        console.error("Email send failed");
        return { accepted: false, status: null, id: null };
    }
}
