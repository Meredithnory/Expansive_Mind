import { EMAIL_CLASS, EMAIL_THEME, emailPanel, escapeHtml, renderEmail, singleLine } from "./email-layout";
import { formatQuotaPeriod } from "./quota-period";

export const LIMIT_ALERT_FEATURES = ["discover", "search", "chat"] as const;
export type LimitAlertFeature = (typeof LIMIT_ALERT_FEATURES)[number];

export function isLimitAlertFeature(value: string): value is LimitAlertFeature {
    return (LIMIT_ALERT_FEATURES as readonly string[]).includes(value);
}

export const LIMIT_FEATURE_LABEL: Record<LimitAlertFeature, string> = {
    discover: "Discoveries",
    search: "Paper searches",
    chat: "AI paper questions",
};

/** Where to look at this person in the admin portal. */
export function adminPersonHref(origin: string, email: string) {
    return `${origin}/admin/people?q=${encodeURIComponent(email)}`;
}

/** The note to Meredith when someone asks for more from the limit pop-up. */
export function limitRequestEmail(input: {
    origin: string;
    name: string;
    email: string;
    feature: LimitAlertFeature;
    used: number | null;
    limit: number | null;
    period: string;
    note: string;
}) {
    const name = singleLine(input.name || input.email, 80);
    const month = formatQuotaPeriod(input.period);
    const label = LIMIT_FEATURE_LABEL[input.feature];
    const href = adminPersonHref(input.origin, input.email);
    const usedLine =
        input.used !== null && input.limit !== null ? `${label}: ${input.used} of ${input.limit}` : label;
    const t = EMAIL_THEME;
    const c = EMAIL_CLASS;
    const row = (title: string, valueHtml: string) =>
        `<tr><td class="${c.muted}" style="padding:0 12px 8px 0;width:72px;vertical-align:top;font-size:14px;font-weight:700;color:${t.muted};">${title}</td><td class="${c.heading}" style="padding:0 0 8px;font-size:14px;color:${t.heading};">${valueHtml}</td></tr>`;
    const details = `<table role="presentation" cellpadding="0" cellspacing="0">${row(
        "Who",
        `${escapeHtml(name)} · <a href="mailto:${escapeHtml(input.email)}" class="${c.link}" style="color:${t.link};text-decoration:none;">${escapeHtml(input.email)}</a>`,
    )}${row("Used", escapeHtml(usedLine))}${row("Month", escapeHtml(month))}</table>`;
    const noteHtml = input.note
        ? emailPanel(
              `<div class="${c.heading}" style="font-size:15px;line-height:1.6;color:${t.heading};white-space:pre-wrap;">${escapeHtml(input.note)}</div>`,
          )
        : "";
    const heading = `${name} asked for more ${label.toLowerCase()}`;
    return {
        subject: singleLine(`${name} asked for more ${label.toLowerCase()} · ${month}`),
        text: [
            heading,
            "",
            `Who: ${name} <${input.email}>`,
            `Used: ${usedLine}`,
            `Month: ${month}`,
            ...(input.note ? ["", "Their note:", input.note] : ["", "No note."]),
            "",
            `Open them in the admin portal: ${href}`,
            "To give them more, reset their usage in People & support. Replying to this email goes straight to them.",
        ].join("\n"),
        html: renderEmail({
            origin: input.origin,
            preheader: input.note ? singleLine(input.note, 120) : `${usedLine} in ${month}`,
            eyebrow: "More requested",
            heading,
            bodyHtml: `${details}${noteHtml}`,
            button: { label: "Open in admin", href },
            footerNote:
                "Sent from the limit pop-up on expansivemind.ai. To give them more, reset their usage in People & support. Replying goes straight to them.",
        }),
    };
}

/** The note to Meredith when someone uses up a monthly allowance. */
export function limitAlertEmail(input: {
    origin: string;
    name: string;
    email: string;
    feature: LimitAlertFeature;
    used: number;
    limit: number;
    period: string;
}) {
    const name = singleLine(input.name || input.email, 80);
    const month = formatQuotaPeriod(input.period);
    const label = LIMIT_FEATURE_LABEL[input.feature];
    const href = adminPersonHref(input.origin, input.email);
    const t = EMAIL_THEME;
    const c = EMAIL_CLASS;
    const row = (title: string, valueHtml: string) =>
        `<tr><td class="${c.muted}" style="padding:0 12px 8px 0;width:72px;vertical-align:top;font-size:14px;font-weight:700;color:${t.muted};">${title}</td><td class="${c.heading}" style="padding:0 0 8px;font-size:14px;color:${t.heading};">${valueHtml}</td></tr>`;
    const details = `<table role="presentation" cellpadding="0" cellspacing="0">${row(
        "Who",
        `${escapeHtml(name)} · <a href="mailto:${escapeHtml(input.email)}" class="${c.link}" style="color:${t.link};text-decoration:none;">${escapeHtml(input.email)}</a>`,
    )}${row("Used", escapeHtml(`${label}: ${input.used} of ${input.limit}`))}${row("Month", escapeHtml(month))}</table>`;
    const heading = `${name} hit a limit`;
    const subject = singleLine(`${name} used all ${input.limit} ${label.toLowerCase()} · ${month}`);
    return {
        subject,
        text: [
            heading,
            "",
            `Who: ${name} <${input.email}>`,
            `Used: ${label}: ${input.used} of ${input.limit}`,
            `Month: ${month}`,
            "",
            `Look at them in the admin portal: ${href}`,
            "To give them more, reset their usage in People & support.",
        ].join("\n"),
        html: renderEmail({
            origin: input.origin,
            preheader: `${label}: ${input.used} of ${input.limit} in ${month}`,
            eyebrow: "Limit reached",
            heading,
            bodyHtml: details,
            button: { label: "Open in admin", href },
            footerNote:
                "You get this once per person and limit each month. To give them more, reset their usage in People & support. Replying goes straight to them.",
        }),
    };
}
