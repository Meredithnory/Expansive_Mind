// The "How is Expansive Mind doing?" prompt: Bad / Fine / Good, then an
// optional comment. Pages ask with askForRating; RatingPrompt decides whether
// to show it.
import { cleanActivityText } from "./activity";

export const RATING_SCORES = ["bad", "fine", "good"] as const;
export type RatingScore = (typeof RATING_SCORES)[number];

export const RATING_SURFACES = ["discover", "paper_chat"] as const;
export type RatingSurface = (typeof RATING_SURFACES)[number];

export const RATING_SURFACE_LABEL: Record<RatingSurface, string> = {
    discover: "After a discovery",
    paper_chat: "After a paper chat answer",
};

/** Ask one browser at most this often, whether they answered or closed it. */
export const RATING_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1_000;
/** Give people time to read the answer before asking about it. */
export const RATING_DELAY_MS = 15_000;
/** A comment can follow its score for this long. */
export const RATING_COMMENT_WINDOW_MS = 60 * 60 * 1_000;

export const RATING_ASK_EVENT = "em:ask-rating";
export const RATING_STORAGE_KEY = "em_rating_asked_at";

const CONTEXT_MAX = 300;
const COMMENT_MAX = 1_000;

export type RatingAsk = { surface: RatingSurface; context: string };

export function isRatingScore(value: unknown): value is RatingScore {
    return RATING_SCORES.includes(value as RatingScore);
}

export function isRatingSurface(value: unknown): value is RatingSurface {
    return RATING_SURFACES.includes(value as RatingSurface);
}

export function shouldAskForRating(lastAskedAt: number | null, now = Date.now()) {
    return !lastAskedAt || !Number.isFinite(lastAskedAt) || now - lastAskedAt >= RATING_COOLDOWN_MS;
}

export function normalizeRating(body: unknown) {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    if (!isRatingScore(data.score) || !isRatingSurface(data.surface)) return null;
    const comment = cleanRatingComment(data.comment);
    return {
        score: data.score,
        surface: data.surface,
        context: cleanActivityText(data.context, CONTEXT_MAX),
        ...(comment ? { comment } : {}),
    };
}

/** Comments keep their line breaks; everything else is plain text. */
export function cleanRatingComment(value: unknown) {
    if (typeof value !== "string") return "";
    return value
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, COMMENT_MAX);
}

/** A comment added to a score this browser just gave. */
export function normalizeRatingComment(body: unknown) {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : "";
    const comment = cleanRatingComment(data.comment);
    return /^[a-f0-9]{24}$/.test(id) && comment ? { id, comment } : null;
}

export type RatingCounts = Record<RatingScore, number>;

export function ratingShares(counts: RatingCounts) {
    const total = counts.bad + counts.fine + counts.good;
    const share = (value: number) => (total ? Math.round((value / total) * 100) : 0);
    return { total, bad: share(counts.bad), fine: share(counts.fine), good: share(counts.good) };
}

/** Ask for a rating from any page. RatingPrompt (in the root layout) listens. */
export function askForRating(surface: RatingSurface, context: string) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<RatingAsk>(RATING_ASK_EVENT, { detail: { surface, context } }),
    );
}
