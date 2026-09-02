import { getMeaningfulSearchTerms } from "../search/springer-query";

export function buildNihDiscoveryQuery(question: string) {
    const terms = getMeaningfulSearchTerms(question).slice(0, 8);
    return terms.length > 0 ? terms.join(" ") : question.trim();
}

const tokenize = (value: string) =>
    value.toLowerCase().match(/[\p{L}\p{N}-]+/gu) || [];

export function applyDiscoverySpellingSuggestion(
    original: string,
    suggestion: string,
) {
    const originalTokens = tokenize(original);
    const suggestedTokens = tokenize(suggestion);
    const meaningfulOriginal = new Set(getMeaningfulSearchTerms(original));

    if (originalTokens.length === suggestedTokens.length) {
        const correctedTerms = suggestedTokens.filter((_, index) =>
            meaningfulOriginal.has(originalTokens[index]),
        );
        if (correctedTerms.length > 0) return correctedTerms.join(" ");
    }

    return buildNihDiscoveryQuery(suggestion);
}
