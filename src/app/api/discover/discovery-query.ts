import { getMeaningfulSearchTerms } from "../search/springer-query";

export function buildNihDiscoveryQuery(question: string) {
    const terms = getMeaningfulSearchTerms(question).slice(0, 8);
    return terms.length > 0 ? terms.join(" ") : question.trim();
}

const tokenize = (value: string) =>
    value.toLowerCase().match(/[\p{L}\p{N}-]+/gu) || [];

const tokenizePreservingCase = (value: string) =>
    value.match(/[\p{L}\p{N}-]+/gu) || [];

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

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splice spelling fixes into the original question. Meaningful subject terms
 * can change; filler words stay as the user wrote them so NIH "does → dose"
 * style mistakes do not rewrite the question.
 */
export function applyDiscoveryQuestionCorrection(
    original: string,
    suggestion: string,
) {
    const originalTrim = original.trim();
    const suggestedTrim = suggestion.trim();
    if (!suggestedTrim) return originalTrim;

    const originalTokens = tokenizePreservingCase(originalTrim);
    const suggestedTokens = tokenizePreservingCase(suggestedTrim);
    const meaningfulOriginal = new Set(getMeaningfulSearchTerms(originalTrim));

    if (originalTokens.length === suggestedTokens.length) {
        let next = originalTrim;
        originalTokens.forEach((token, index) => {
            const replacement = suggestedTokens[index];
            if (
                !replacement ||
                token.toLowerCase() === replacement.toLowerCase() ||
                !meaningfulOriginal.has(token.toLowerCase())
            ) {
                return;
            }
            const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "i");
            next = next.replace(pattern, () => replacement);
        });
        return next;
    }

    if (
        suggestedTrim.length <=
        Math.max(originalTrim.length * 2, originalTrim.length + 40)
    ) {
        return suggestedTrim;
    }

    return originalTrim;
}
