import { DEVELOPER_NAME } from "./contact";
import { greetingName } from "./contact-mail";
import { EMAIL_CLASS, EMAIL_THEME, escapeHtml, renderEmail } from "./email-layout";

export type ProAllowance = {
    discover: number;
    search: number;
    scholar_search: number;
    chat: number;
    projects: number;
};

/** What Pro includes, one line each, from the live plan settings. */
export function proAllowanceLines(allowance: ProAllowance) {
    return [
        `${allowance.discover} discoveries: cited reports from one research question`,
        `${allowance.search} paper searches, including ${allowance.scholar_search} on Google Scholar`,
        `${allowance.chat} paper assistant questions, plus asking about figures and screenshots`,
        `${allowance.projects} research projects`,
        "No cap on saved papers",
    ];
}

/**
 * "You have Researcher Pro": sent when an admin grants complimentary Pro.
 * Paid plans are hidden on the site, so this email is where someone learns
 * what they were given.
 */
export function proAccessEmail(input: {
    origin: string;
    firstName?: string;
    email: string;
    allowance: ProAllowance;
}) {
    const first = greetingName(input.firstName ?? "");
    const builder = DEVELOPER_NAME.split(" ")[0];
    const heading = first ? `${first}, you have Researcher Pro` : "You have Researcher Pro";
    const intro = `${builder}, who builds Expansive Mind, gave your account Researcher Pro at no cost. Each month you now get:`;
    const lines = proAllowanceLines(input.allowance);
    const outro = `It starts over on the 1st of each month. There's nothing to pay and nothing to set up: sign in with ${input.email} as usual.`;
    const footer = `You're getting this because ${builder} added Researcher Pro to your account. Questions? Reply to this email.`;
    const href = `${input.origin}/discover`;
    const t = EMAIL_THEME;
    const c = EMAIL_CLASS;
    const list = `<ul style="margin:12px 0 16px;padding-left:20px;">${lines
        .map(
            (line) =>
                `<li class="${c.heading}" style="margin:0 0 6px;font-size:15px;line-height:1.5;color:${t.heading};">${escapeHtml(line)}</li>`,
        )
        .join("")}</ul>`;
    return {
        subject: "You have Researcher Pro on Expansive Mind, at no cost",
        text: [
            heading,
            "",
            intro,
            ...lines.map((line) => `- ${line}`),
            "",
            outro,
            "",
            `Open Expansive Mind: ${href}`,
            "",
            footer,
        ].join("\n"),
        html: renderEmail({
            origin: input.origin,
            preheader: "More discoveries, searches, and paper questions every month. Nothing to pay.",
            eyebrow: "Complimentary access",
            heading,
            bodyHtml: `${escapeHtml(intro)}${list}${escapeHtml(outro)}`,
            button: { label: "Open Expansive Mind", href },
            footerNote: footer,
        }),
    };
}
