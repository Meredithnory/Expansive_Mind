const SEARCH_STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "do",
    "does",
    "effect",
    "effects",
    "affect",
    "association",
    "associations",
    "for",
    "from",
    "help",
    "how",
    "impact",
    "impacts",
    "improve",
    "improves",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "outcomes",
    "over",
    "relationship",
    "relationships",
    "role",
    "the",
    "their",
    "these",
    "this",
    "to",
    "treatment",
    "treatments",
    "type",
    "using",
    "versus",
    "vs",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
]);

const quoteSpringerTerm = (word: string) =>
    `keyword:"${word.replace(/"/g, '\\"')}"`;

export const getMeaningfulSearchTerms = (searchValue: string) =>
    Array.from(
        new Set(
            searchValue
                .toLowerCase()
                .match(/[\p{L}\p{N}-]+/gu)
                ?.filter(
                    (word) =>
                        word.length > 1 && !SEARCH_STOP_WORDS.has(word),
                ) || [],
        ),
    );

/** Prefer distinctive terms (longer first) for Springer keyword queries. */
const rankSearchTerms = (terms: string[]) =>
    [...terms].sort(
        (left, right) =>
            right.length - left.length || left.localeCompare(right),
    );

/**
 * Preserve the first specific subject in the user's wording. Biomedical names
 * containing a number or hyphen (GLP-1, IL-6, SGLT-2) are especially strong
 * anchors and must remain present when the query is broadened.
 */
export const selectSpringerAnchor = (terms: string[]): string | undefined =>
    terms.find((term) => /[\d-]/.test(term)) || terms[0];

/**
 * Springer returns HTTP 404 when a query has zero matches. Long research
 * questions that AND every token almost always hit that case. Keep one
 * distinctive subject mandatory and pair it with the strongest context term.
 */
export const buildSpringerSearchQuery = (searchValue: string): string => {
    const trimmed = searchValue.trim().toLowerCase().replace(/\s+/g, " ");
    if (!trimmed) return "";

    const terms = getMeaningfulSearchTerms(trimmed);
    if (terms.length === 0) {
        return quoteSpringerTerm(trimmed.replace(/"/g, '\\"'));
    }

    if (terms.length === 1) {
        return quoteSpringerTerm(terms[0]);
    }

    const wordCount = trimmed.split(" ").length;

    // Short topic searches: phrase match OR tight AND of the terms.
    if (wordCount <= 4 && terms.length === 2) {
        const phrase = terms.join(" ");
        const andClause = terms.map(quoteSpringerTerm).join(" AND ");
        return `(${quoteSpringerTerm(phrase)} OR (${andClause}))`;
    }

    const anchor = selectSpringerAnchor(terms)!;
    const context = rankSearchTerms(
        terms.filter((term) => term !== anchor),
    )[0];

    return context
        ? `(${quoteSpringerTerm(anchor)} AND ${quoteSpringerTerm(context)})`
        : quoteSpringerTerm(anchor);
};

/**
 * Broaden only to the required subject. Never fall back to standalone context
 * words such as "women" or "pregnancy", which swamp the relevant results.
 */
export const buildSpringerFallbackQuery = (searchValue: string): string => {
    const terms = getMeaningfulSearchTerms(searchValue);
    const anchor = selectSpringerAnchor(terms);
    return anchor ? quoteSpringerTerm(anchor) : "";
};
