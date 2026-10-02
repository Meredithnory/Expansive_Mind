// The "you've used your discoveries" pop-up for signed-in people. Pages call
// showLimitReached when the server refuses for a used-up monthly allowance;
// LimitReachedModal (root layout) shows it. Guests have their own pop-up.

export const LIMIT_REACHED_EVENT = "em:limit-reached";

export const LIMIT_REQUEST_FEATURES = ["discover", "search", "chat"] as const;
export type LimitRequestFeature = (typeof LIMIT_REQUEST_FEATURES)[number];

export type LimitReached = { feature: LimitRequestFeature; limit: number | null };

export function isLimitRequestFeature(value: unknown): value is LimitRequestFeature {
    return LIMIT_REQUEST_FEATURES.includes(value as LimitRequestFeature);
}

/** Open the pop-up from any page. */
export function showLimitReached(feature: LimitRequestFeature, limit?: number | null) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<LimitReached>(LIMIT_REACHED_EVENT, {
            detail: { feature, limit: typeof limit === "number" && limit > 0 ? limit : null },
        }),
    );
}

const NOTE_MAX = 600;

/** A request for more: which allowance, and an optional note. */
export function normalizeLimitRequest(body: unknown) {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    if (!isLimitRequestFeature(data.feature)) return null;
    const note =
        typeof data.note === "string"
            ? data.note.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim().slice(0, NOTE_MAX)
            : "";
    return { feature: data.feature, note };
}
