export interface SearchSuggestion {
    originalQuery: string;
    suggestedQuery: string;
    suggestedTotalCount: number;
}

export const normalizeSearchQuery = (query: string) =>
    query.trim().toLowerCase().replace(/\s+/g, " ");

export const searchQueriesMatch = (left: string, right: string) =>
    normalizeSearchQuery(left) === normalizeSearchQuery(right);

export const getGhostCompletionSuffix = (
    value: string,
    completion: string | null | undefined,
): string => {
    if (!completion || !value || searchQueriesMatch(value, completion)) {
        return "";
    }

    const valueLower = value.toLowerCase();
    const completionLower = completion.toLowerCase();

    if (completionLower.startsWith(valueLower)) {
        return completion.slice(value.length);
    }

    return "";
};

export type SearchSourceFilter = "all" | "nih" | "springer" | "scholar";

export async function fetchSearchSuggestion(
    query: string,
    source: SearchSourceFilter = "all",
): Promise<SearchSuggestion | null> {
    const trimmed = query.trim();
    if (!trimmed) {
        return null;
    }

    const params = new URLSearchParams({
        q: trimmed,
    });

    if (source !== "all") {
        params.set("source", source);
    }

    const res = await fetch(`/api/search/suggest?${params.toString()}`);

    if (!res.ok) {
        return null;
    }

    const data = await res.json();
    if (!data.suggestedQuery) {
        return null;
    }

    return {
        originalQuery: data.originalQuery ?? trimmed,
        suggestedQuery: data.suggestedQuery,
        suggestedTotalCount: data.suggestedTotalCount ?? 0,
    };
}

const inlineCompletionCache = new Map<string, string | null>();

const findCachedPrefixCompletion = (query: string): string | null => {
    const lower = query.toLowerCase();

    for (const value of inlineCompletionCache.values()) {
        if (
            value &&
            value.toLowerCase().startsWith(lower) &&
            !searchQueriesMatch(query, value)
        ) {
            return value;
        }
    }

    return null;
};

export async function fetchInlineCompletion(
    query: string,
): Promise<string | null> {
    const trimmed = query.trim();
    if (!trimmed) {
        return null;
    }

    const cacheKey = normalizeSearchQuery(trimmed);
    if (inlineCompletionCache.has(cacheKey)) {
        return inlineCompletionCache.get(cacheKey) ?? null;
    }

    const prefixMatch = findCachedPrefixCompletion(trimmed);
    if (prefixMatch) {
        return prefixMatch;
    }

    const res = await fetch(
        `/api/search/autocomplete?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
    );

    if (!res.ok) {
        return null;
    }

    const data = await res.json();
    const completion = data.completion ?? null;

    inlineCompletionCache.set(cacheKey, completion);
    if (inlineCompletionCache.size > 120) {
        const oldestKey = inlineCompletionCache.keys().next().value;
        if (oldestKey) inlineCompletionCache.delete(oldestKey);
    }

    return completion;
}
