import { searchQueriesMatch, normalizeSearchQuery } from "./search-suggest";
import type { DiscoveryQueryAssessment } from "./query-quality";

const assessmentCache = new Map<string, DiscoveryQueryAssessment>();

export async function fetchDiscoveryQueryAssessment(
    query: string,
): Promise<DiscoveryQueryAssessment | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;

    const cacheKey = normalizeSearchQuery(trimmed);
    if (assessmentCache.has(cacheKey)) {
        return assessmentCache.get(cacheKey) ?? null;
    }

    const res = await fetch(
        `/api/discover/suggest?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
    );
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return null;

    const status = data.status;
    if (status !== "ok" && status !== "corrected" && status !== "unclear") {
        return null;
    }

    const suggestion =
        typeof data.suggestedQuery === "string" ? data.suggestedQuery.trim() : "";

    const assessment: DiscoveryQueryAssessment =
        status === "corrected" &&
        suggestion &&
        !searchQueriesMatch(trimmed, suggestion)
            ? { status: "corrected", suggestion }
            : { status: status === "unclear" ? "unclear" : "ok", suggestion: null };

    assessmentCache.set(cacheKey, assessment);
    if (assessmentCache.size > 80) {
        const oldestKey = assessmentCache.keys().next().value;
        if (oldestKey) assessmentCache.delete(oldestKey);
    }

    return assessment;
}
