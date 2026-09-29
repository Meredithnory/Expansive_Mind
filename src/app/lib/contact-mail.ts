import type { ContactFields } from "./contact";
import { DEVELOPER_NAME } from "./contact";
import { EMAIL_THEME, emailPanel, escapeHtml, renderEmail, singleLine } from "./email-layout";

type Mail = { subject: string; text: string; html: string };

function formatSent(sentAt: Date) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        timeZoneName: "short",
    }).format(sentAt);
}

/**
 * First name for "Thanks, Ada." Only a plain name passes: the reply goes to
 * whatever address was typed, so nothing that could carry a link or a pitch
 * is echoed back.
 */
export function greetingName(name: string): string | null {
    const first = name.trim().split(/\s+/)[0] || "";
    // Letters, apostrophes, and hyphens; a dot only at the end ("J."), so a
    // domain like www.example.com never passes.
    return /^\p{L}[\p{L}'’-]{0,29}\.?$/u.test(first) ? first : null;
}

/** What lands in Meredith's inbox. Reply goes straight to the sender. */
export function contactNotificationEmail(
    fields: ContactFields,
    { origin, sentAt = new Date() }: { origin: string; sentAt?: Date },
): Mail {
    const name = singleLine(fields.name, 80);
    const firstName = greetingName(name) ?? "them";
    const t = EMAIL_THEME;
    const row = (label: string, valueHtml: string) =>
        `<tr><td style="padding:0 12px 8px 0;width:64px;vertical-align:top;font-size:14px;font-weight:700;color:${t.muted};">${label}</td><td style="padding:0 0 8px;font-size:14px;color:#e6eef8;">${valueHtml}</td></tr>`;
    const details = `<table role="presentation" cellpadding="0" cellspacing="0">${row(
        "From",
        `${escapeHtml(name)} · <a href="mailto:${escapeHtml(fields.email)}" style="color:${t.link};text-decoration:none;">${escapeHtml(fields.email)}</a>`,
    )}${row("Topic", escapeHtml(fields.topic))}${row("Sent", escapeHtml(formatSent(sentAt)))}</table>`;
    const message = emailPanel(
        `<div style="font-size:15px;line-height:1.65;color:#f2f7ff;white-space:pre-wrap;">${escapeHtml(fields.message)}</div>`,
    );
    const replyHref = `mailto:${fields.email}?subject=${encodeURIComponent(`Re: Expansive Mind · ${fields.topic}`)}`;
    return {
        subject: singleLine(`New message · ${fields.topic} · from ${name}`),
        text: [
            `New message · ${fields.topic}`,
            "",
            `From: ${name} <${fields.email}>`,
            `Topic: ${fields.topic}`,
            `Sent: ${formatSent(sentAt)}`,
            "",
            fields.message,
            "",
            "Reply to this email to answer them directly.",
        ].join("\n"),
        html: renderEmail({
            origin,
            preheader: singleLine(fields.message, 120),
            eyebrow: `New message · ${fields.topic}`,
            heading: `${name} wrote in`,
            bodyHtml: `${details}${message}`,
            button: { label: `Reply to ${firstName}`, href: replyHref },
            footerNote: `Sent from the contact form at expansivemind.ai/contact. Replying to this email goes straight to ${firstName}.`,
        }),
    };
}

/**
 * The short "we got it" reply to the person who wrote in. It never repeats
 * their message, so the form can't be used to send text to someone else.
 */
export function contactConfirmationEmail(
    fields: Pick<ContactFields, "name">,
    { origin }: { origin: string },
): Mail {
    const first = greetingName(fields.name);
    const heading = first ? `Thanks, ${first}. We got your note.` : "Thanks. We got your note.";
    const builder = DEVELOPER_NAME.split(" ")[0];
    const body = `It went straight to ${builder}, who builds Expansive Mind. A human reads every message, and her reply will come from her own inbox.`;
    const footer =
        "You're getting this because this address was entered on the contact form at expansivemind.ai. If that wasn't you, you can ignore this email.";
    return {
        subject: "We got your message",
        text: [heading, "", body, "", origin, "", footer].join("\n"),
        html: renderEmail({
            origin,
            preheader: `It went straight to ${builder}. A human reads every message.`,
            eyebrow: "Message received",
            heading,
            bodyHtml: escapeHtml(body),
            button: { label: "Back to Expansive Mind", href: origin },
            footerNote: footer,
        }),
    };
}
