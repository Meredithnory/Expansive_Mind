// Admin email from /admin/email: who it may go to, and what it looks like.
import { escapeHtml, renderEmail, singleLine } from "./email-layout";

export const ADMIN_EMAIL_AUDIENCES = ["one", "pro", "free", "new"] as const;
export type AdminEmailAudience = (typeof ADMIN_EMAIL_AUDIENCES)[number];

export const ADMIN_EMAIL_SUBJECT_MAX = 200;
export const ADMIN_EMAIL_BODY_MAX = 10_000;
/** A group send stops here; bigger lists need a queue first. */
export const ADMIN_EMAIL_MAX_RECIPIENTS = 500;

/** Newsletters and product updates come from their own address, apart from account mail. */
export const PRODUCT_EMAIL_FROM_DEFAULT = "Expansive Mind <newsletter@expansivemind.ai>";
/**
 * Admin email per UTC day. Resend's free plan allows 100 a day across all
 * mail, so this leaves room for password resets and contact replies.
 */
export const PRODUCT_EMAIL_DAILY_MAX_DEFAULT = 50;

export type ProductEmailSettings = {
    /** Printed in every group email's footer (CAN-SPAM). Group sends wait for it. */
    postalAddress: string | null;
    from: string;
    dailyMax: number;
};

/** Reads EMAIL_POSTAL_ADDRESS, PRODUCT_EMAIL_FROM, and PRODUCT_EMAIL_DAILY_MAX. */
export function productEmailSettings(
    env: Record<string, string | undefined>,
): ProductEmailSettings {
    const dailyMax = Number(env.PRODUCT_EMAIL_DAILY_MAX);
    return {
        postalAddress: singleLine(env.EMAIL_POSTAL_ADDRESS ?? "", 300) || null,
        from: singleLine(env.PRODUCT_EMAIL_FROM ?? "", 200) || PRODUCT_EMAIL_FROM_DEFAULT,
        dailyMax:
            env.PRODUCT_EMAIL_DAILY_MAX && Number.isInteger(dailyMax) && dailyMax >= 0
                ? Math.min(dailyMax, 10_000)
                : PRODUCT_EMAIL_DAILY_MAX_DEFAULT,
    };
}

/**
 * Group sends always go to opted-in people only: an unsubscribe turns the
 * opt-in off, so there is no switch that could reach them again. A note to
 * one person is a support message, not product email.
 */
export type AdminEmailInput = {
    audience: AdminEmailAudience;
    userId: string | null;
    subject: string;
    body: string;
    test: boolean;
};

export function parseAdminEmailInput(
    raw: unknown,
): { ok: true; value: AdminEmailInput } | { ok: false; error: string } {
    if (!raw || typeof raw !== "object") return { ok: false, error: "A message is required." };
    const value = raw as Record<string, unknown>;
    const audience = value.audience;
    if (!ADMIN_EMAIL_AUDIENCES.includes(audience as AdminEmailAudience)) {
        return { ok: false, error: "Choose who gets this email." };
    }
    const subject = singleLine(typeof value.subject === "string" ? value.subject : "", ADMIN_EMAIL_SUBJECT_MAX);
    if (!subject) return { ok: false, error: "Add a subject." };
    const body = typeof value.body === "string" ? value.body.trim() : "";
    if (!body) return { ok: false, error: "Write a message." };
    if (body.length > ADMIN_EMAIL_BODY_MAX) {
        return { ok: false, error: "That message is too long." };
    }
    const userId = typeof value.userId === "string" && /^[a-f0-9]{24}$/i.test(value.userId)
        ? value.userId
        : null;
    if (audience === "one" && !userId) {
        return { ok: false, error: "Pick the person to email." };
    }
    return {
        ok: true,
        value: {
            audience: audience as AdminEmailAudience,
            userId,
            subject,
            body,
            test: value.test === true,
        },
    };
}

/** Blank lines split paragraphs; single newlines stay as line breaks. */
export function adminEmailBodyHtml(body: string) {
    return body
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph) => escapeHtml(paragraph.trim()).replace(/\n/g, "<br>"))
        .filter(Boolean)
        .join("<br><br>");
}

export function adminEmailContent(input: {
    subject: string;
    body: string;
    origin: string;
    /** Group sends carry an unsubscribe link; a note to one person does not. */
    unsubscribeUrl?: string | null;
    /** Group sends carry the mailing address too. */
    postalAddress?: string | null;
}) {
    const footerNote = input.unsubscribeUrl
        ? "You get this because you signed up for the Expansive Mind newsletter and product updates."
        : "Sent by the Expansive Mind team. Reply to this email to reach us.";
    const footerLinkHtml = input.unsubscribeUrl
        ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">Unsubscribe</a>`
        : undefined;
    const text = [
        "Expansive Mind",
        "",
        input.subject,
        "",
        input.body.trim(),
        "",
        footerNote,
        ...(input.unsubscribeUrl ? [`Unsubscribe: ${input.unsubscribeUrl}`] : []),
        ...(input.postalAddress ? ["", input.postalAddress] : []),
    ].join("\n");
    const html = renderEmail({
        origin: input.origin,
        preheader: singleLine(input.body, 140),
        eyebrow: "From Expansive Mind",
        heading: input.subject,
        bodyHtml: adminEmailBodyHtml(input.body),
        footerNote,
        ...(footerLinkHtml ? { footerLinkHtml } : {}),
        ...(input.postalAddress ? { postalAddress: input.postalAddress } : {}),
    });
    return { subject: input.subject, text, html };
}
