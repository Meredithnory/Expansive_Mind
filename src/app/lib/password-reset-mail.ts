import "server-only";
import {
    passwordResetFromAddress,
    passwordResetHtml,
    passwordResetSubject,
    passwordResetText,
} from "./password-reset";

export type PasswordResetSendResult = {
    accepted: boolean;
    status: number | null;
    id: string | null;
};

export async function sendPasswordResetEmail(input: {
    to: string;
    link: string;
}): Promise<PasswordResetSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { accepted: false, status: null, id: null };
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: passwordResetFromAddress(),
            to: [input.to],
            subject: passwordResetSubject(),
            text: passwordResetText(input.link),
            html: passwordResetHtml(input.link),
        }),
    });

    if (!response.ok) {
        console.error("Password reset email failed", response.status);
        return { accepted: false, status: response.status, id: null };
    }

    const body = (await response.json().catch(() => null)) as {
        id?: unknown;
    } | null;
    const id = body && typeof body.id === "string" ? body.id : null;
    return { accepted: true, status: response.status, id };
}
