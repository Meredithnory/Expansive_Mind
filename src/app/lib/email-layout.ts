// Branded HTML email shell shared by password reset and contact mail.
// Email clients need tables, inline styles, and hex colors. See the Emails
// page of the design canvas for the target look.

export const DEFAULT_FROM_ADDRESS = "Expansive Mind <support@expansivemind.ai>";

export const EMAIL_THEME = {
    background: "#000000",
    card: "#0a0a0f",
    cardBorder: "#1a1a22",
    panel: "#111118",
    heading: "#ffffff",
    text: "#c9d1dc",
    muted: "#7c8594",
    eyebrow: "#ff3d9a",
    pink: "#ff0084",
    link: "#ff8ec4",
    font: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** Sender for every Expansive Mind email; `CONTACT_FROM_EMAIL` overrides. */
export function emailFromAddress(env?: { CONTACT_FROM_EMAIL?: string }) {
    const from =
        env === undefined ? process.env.CONTACT_FROM_EMAIL : env.CONTACT_FROM_EMAIL;
    return from || DEFAULT_FROM_ADDRESS;
}

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** One line, no control characters: safe for a subject or a header. */
export function singleLine(value: string, max = 200) {
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export type EmailButton = { label: string; href: string };

/**
 * The shell: logo and wordmark, pink eyebrow, heading, body, an optional
 * button, and a footer. `bodyHtml` must already be escaped.
 */
export function renderEmail(input: {
    origin: string;
    preheader: string;
    eyebrow: string;
    heading: string;
    bodyHtml: string;
    button?: EmailButton;
    /** Escaped HTML under the button (the reset link to paste). */
    afterButtonHtml?: string;
    footerNote: string;
    year?: number;
}) {
    const t = EMAIL_THEME;
    const year = input.year ?? new Date().getFullYear();
    const logo = `${input.origin}/email/brainlogo.png`;
    const button = input.button
        ? `<tr><td style="padding:0 0 28px;"><a href="${escapeHtml(input.button.href)}" style="display:inline-block;background:${t.pink};color:${t.heading};text-decoration:none;font-weight:700;font-size:16px;line-height:48px;border-radius:999px;padding:0 24px;">${escapeHtml(input.button.label)}</a></td></tr>`
        : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${t.background};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${t.card};border:1px solid ${t.cardBorder};border-radius:24px;">
          <tr>
            <td style="padding:40px 36px 32px;font-family:${t.font};">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="padding:0 0 28px;">
                  <img src="${escapeHtml(logo)}" width="36" height="36" alt="Expansive Mind logo" style="display:inline-block;vertical-align:middle;border:0;">
                  <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:18px;font-weight:700;color:${t.heading};">Expansive Mind</span>
                </td></tr>
                <tr><td style="padding:0 0 12px;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${t.eyebrow};">${escapeHtml(input.eyebrow)}</td></tr>
                <tr><td style="padding:0 0 16px;font-size:30px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;color:${t.heading};">${escapeHtml(input.heading)}</td></tr>
                <tr><td style="padding:0 0 28px;font-size:16px;line-height:1.6;color:${t.text};">${input.bodyHtml}</td></tr>
                ${button}
                ${input.afterButtonHtml ? `<tr><td style="padding:0 0 28px;">${input.afterButtonHtml}</td></tr>` : ""}
                <tr><td style="padding:20px 0 0;border-top:1px solid ${t.cardBorder};font-size:13px;line-height:1.55;color:${t.muted};">
                  ${escapeHtml(input.footerNote)}<br><br>© ${year} Expansive Mind. All rights reserved.
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** A dark panel, for a pasted link or a quoted message. Content must be escaped. */
export function emailPanel(innerHtml: string, marginTop = 20) {
    const t = EMAIL_THEME;
    return `<div style="margin:${marginTop}px 0 0;padding:16px 18px;border-radius:16px;background:${t.panel};">${innerHtml}</div>`;
}
