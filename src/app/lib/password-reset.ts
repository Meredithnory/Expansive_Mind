import { createHash, randomBytes } from "crypto";

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

/** Login card, nav wordmark, and footer colors. Email clients need hex. */
export const PASSWORD_RESET_EMAIL_THEME = {
    background: "#000000",
    cardBorder: "#141414",
    heading: "#ffffff",
    text: "#d7ebff",
    muted: "#8c8c8c",
    pink: "#ff0084",
    font: "Manrope, system-ui, sans-serif",
} as const;

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
    const from =
        env === undefined
            ? process.env.CONTACT_FROM_EMAIL
            : env.CONTACT_FROM_EMAIL;
    return from || "Expansive Mind <beth.t@example.com>";
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

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function passwordResetHtml(link: string, year = new Date().getFullYear()) {
    const theme = PASSWORD_RESET_EMAIL_THEME;
    const safeLink = escapeHtml(link);
    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${theme.background};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${theme.background};border:1px solid ${theme.cardBorder};border-radius:24px;">
          <tr>
            <td style="padding:44px 36px;font-family:${theme.font};">
              <p style="margin:0 0 28px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:${theme.heading};">Expansive Mind</p>
              <h1 style="margin:0 0 16px;font-size:32px;font-weight:600;letter-spacing:-0.02em;color:${theme.heading};">Reset your password</h1>
              <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:${theme.text};">Choose a new password with the link below. It works once and expires in one hour.</p>
              <a href="${safeLink}" style="display:inline-block;background:${theme.pink};color:${theme.heading};text-decoration:none;font-weight:600;font-size:16px;border-radius:16px;padding:16px 22px;">Choose a new password</a>
              <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:${theme.muted};">Or copy this link:<br><a href="${safeLink}" style="color:${theme.pink};word-break:break-all;">${safeLink}</a></p>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:${theme.muted};">If you didn't ask for this, you can ignore this email. Your password will stay the same.</p>
              <p style="margin:32px 0 0;font-size:13px;color:${theme.muted};">© ${year} Expansive Mind. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
