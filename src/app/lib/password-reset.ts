import { createHash, randomBytes } from "crypto";
import {
    EMAIL_THEME,
    emailFromAddress,
    emailPanel,
    escapeHtml,
    renderEmail,
} from "./email-layout";

export {
    PASSWORD_RESET_CONFIRM_RATE_LIMIT,
    PASSWORD_RESET_INVALID_EMAIL,
    PASSWORD_RESET_LINK_INVALID,
    PASSWORD_RESET_PASSWORD_RULE,
    PASSWORD_RESET_RATE_LIMIT,
    PASSWORD_RESET_REQUEST_MESSAGE,
    PASSWORD_RESET_UNAVAILABLE,
    PASSWORD_RESET_UPDATED,
} from "./password-reset-copy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Same palette as every Expansive Mind email (see email-layout.ts). */
export const PASSWORD_RESET_EMAIL_THEME = EMAIL_THEME;

export function normalizeAccountEmail(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const email = value.trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
    return email;
}

export function normalizeNewPassword(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const password = value.trim();
    if (password.length < 6 || password.length > 128) return null;
    return password;
}

export function createPasswordResetToken() {
    return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export function isPasswordResetToken(value: string) {
    return TOKEN_PATTERN.test(value);
}

export function buildPasswordResetLink(origin: string, token: string) {
    const url = new URL("/reset-password", origin);
    url.searchParams.set("token", token);
    return url.toString();
}

export function passwordResetFromAddress(env?: {
    CONTACT_FROM_EMAIL?: string;
}) {
    return emailFromAddress(env);
}

export function passwordResetSubject() {
    return "Reset your Expansive Mind password";
}

export function passwordResetText(link: string, year = new Date().getFullYear()) {
    return [
        "Expansive Mind",
        "",
        "Reset your password",
        "",
        "Choose a new password with this link. It works once and expires in one hour.",
        "",
        link,
        "",
        "If you didn't ask for this, you can ignore this email. Your password will stay the same.",
        "",
        `© ${year} Expansive Mind. All rights reserved.`,
    ].join("\n");
}

export function passwordResetHtml(link: string, year = new Date().getFullYear()) {
    const safeLink = escapeHtml(link);
    return renderEmail({
        origin: new URL(link).origin,
        preheader: "Choose a new password with the link inside. It works once and expires in one hour.",
        eyebrow: "Password reset",
        heading: "Reset your password",
        bodyHtml:
            "Choose a new password with the button below. The link works once and expires in one hour.",
        button: { label: "Choose a new password", href: link },
        afterButtonHtml: emailPanel(
            `<span style="display:block;margin:0 0 6px;font-size:12px;font-weight:700;color:${EMAIL_THEME.muted};">Or paste this link into your browser</span><a href="${safeLink}" style="font-size:13px;line-height:1.5;color:${EMAIL_THEME.link};word-break:break-all;text-decoration:none;">${safeLink}</a>`,
            0,
        ),
        footerNote:
            "If you didn't ask for this, you can ignore this email. Your password stays the same.",
        year,
    });
}
