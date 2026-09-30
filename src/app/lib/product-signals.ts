// Product moments the admin pulse counts per day. Keys only: no people,
// no paper text, no questions.
export const PRODUCT_SIGNALS = [
    /** A citation opened with no recorded sentence; the reader showed the closest match. */
    "citation_closest_match",
    /** A citation opened with no recorded sentence and no clear match in the paper. */
    "citation_no_match",
] as const;

export type ProductSignal = (typeof PRODUCT_SIGNALS)[number];

export function isProductSignal(value: unknown): value is ProductSignal {
    return PRODUCT_SIGNALS.includes(value as ProductSignal);
}

/** Fire-and-forget from the browser. Never throws, never blocks the page. */
export function sendProductSignal(signal: ProductSignal) {
    if (typeof window === "undefined") return;
    void fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
        keepalive: true,
    }).catch(() => undefined);
}
