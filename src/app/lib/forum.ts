// Browser-safe forum rules shared by routes and pages.

export const FORUM_BODY_MAX = 2_000;
export const FORUM_COMMENT_MAX = 2_000;
export const FORUM_TAG_LIMIT = 3;
export const FORUM_HIGHLIGHT_LIMIT = 10;
export const FORUM_PAGE_SIZE = 20;
/** Reports from this many different people hide an item until an admin looks. */
export const FORUM_AUTO_HIDE_REPORTS = 3;
/** New accounts read and follow right away but wait a day to post publicly. */
export const FORUM_NEW_ACCOUNT_WAIT_MS = 24 * 60 * 60 * 1000;

export const FORUM_REPORT_REASONS = [
    { id: "spam", label: "Spam or advertising" },
    { id: "harassment", label: "Harassment or hate" },
    { id: "misinformation", label: "Misleading about the science" },
    { id: "copyright", label: "Copyright problem" },
    { id: "other", label: "Something else" },
] as const;

export type ForumReportReason = (typeof FORUM_REPORT_REASONS)[number]["id"];

export function isReportReason(value: unknown): value is ForumReportReason {
    return FORUM_REPORT_REASONS.some((reason) => reason.id === value);
}

/** "#Gut-Microbiome, crispr" -> ["gut-microbiome", "crispr"] (max 3, 2-30 chars). */
export function parseTags(value: unknown): string[] {
    const raw = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(/[\s,]+/)
          : [];
    const tags: string[] = [];
    for (const item of raw) {
        if (typeof item !== "string") continue;
        const tag = item
            .toLowerCase()
            .replace(/^#+/, "")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-{2,}/g, "-")
            .replace(/^-|-$/g, "");
        if (tag.length >= 2 && tag.length <= 30 && !tags.includes(tag)) {
            tags.push(tag);
        }
        if (tags.length === FORUM_TAG_LIMIT) break;
    }
    return tags;
}

export function isTag(value: unknown): value is string {
    return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(value);
}

/** Public display name: first name and last initial ("Meredith S."). */
export function publicName(firstName?: string | null, lastName?: string | null) {
    const first = (firstName || "").trim();
    const initial = (lastName || "").trim().charAt(0);
    if (!first) return "Researcher";
    return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

export function canPostPublicly(signedUpAt: Date | string | null | undefined, now = Date.now()) {
    if (!signedUpAt) return true;
    const time = new Date(signedUpAt).getTime();
    return Number.isNaN(time) || now - time >= FORUM_NEW_ACCOUNT_WAIT_MS;
}
