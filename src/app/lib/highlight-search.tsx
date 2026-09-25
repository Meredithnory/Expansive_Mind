import React from "react";

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Short function words — skip when picking abstract-only highlight terms. */
const ABSTRACT_HIGHLIGHT_STOP_WORDS = new Set([
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
    "for",
    "from",
    "how",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "over",
    "the",
    "their",
    "these",
    "this",
    "to",
    "vs",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
]);

export const getSearchTerms = (searchValue: string): string[] =>
    searchValue
        .trim()
        .split(/\s+/)
        .filter((term) => term.length > 0);

export const titleMatchesSearch = (
    title: string | null | undefined,
    searchValue: string,
): boolean => {
    if (!title) {
        return false;
    }

    const lowerTitle = title.toLowerCase();
    const terms = getSearchTerms(searchValue);

    if (!terms.length) {
        return false;
    }

    return terms.some((term) => lowerTitle.includes(term.toLowerCase()));
};

const hasWholeWord = (text: string, term: string): boolean =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);

/**
 * Terms to highlight in a card abstract: meaningful query tokens that are
 * absent from the title (substring, matching title highlight) but present as
 * whole words in the abstract. Skips stopwords and tokens under 3 characters.
 */
export const getAbstractHighlightTerms = (
    searchValue: string,
    title: string | null | undefined,
    abstract: string | null | undefined,
): string[] => {
    if (!searchValue.trim() || !abstract?.trim()) {
        return [];
    }

    const lowerTitle = (title || "").toLowerCase();
    const tokens =
        searchValue
            .trim()
            .toLowerCase()
            .match(/[\p{L}\p{N}-]+/gu) || [];

    const seen = new Set<string>();
    const terms: string[] = [];

    for (const token of tokens) {
        if (token.length < 3) continue;
        if (ABSTRACT_HIGHLIGHT_STOP_WORDS.has(token)) continue;
        if (seen.has(token)) continue;
        if (lowerTitle.includes(token)) continue;
        if (!hasWholeWord(abstract, token)) continue;

        seen.add(token);
        terms.push(token);
    }

    return terms;
};

interface HighlightSearchTitleProps {
    title: string | null | undefined;
    searchValue: string;
    highlightClass: string;
    className?: string;
}

export const HighlightSearchTitle = ({
    title,
    searchValue,
    highlightClass,
    className,
}: HighlightSearchTitleProps) => {
    const safeTitle = title?.trim() || "Untitled";

    if (!searchValue.trim() || !titleMatchesSearch(safeTitle, searchValue)) {
        return <span className={className}>{safeTitle}</span>;
    }

    const terms = getSearchTerms(searchValue);
    const pattern = terms.map(escapeRegExp).join("|");
    const parts = safeTitle.split(new RegExp(`(${pattern})`, "gi"));

    return (
        <span className={className}>
            {parts.map((part, index) => {
                const isMatch = terms.some(
                    (term) => part.toLowerCase() === term.toLowerCase(),
                );

                if (isMatch) {
                    return (
                        <span key={index} className={highlightClass}>
                            {part}
                        </span>
                    );
                }

                return (
                    <span key={index}>{part}</span>
                );
            })}
        </span>
    );
};

interface HighlightSearchAbstractProps {
    abstract: string;
    searchValue: string;
    title: string | null | undefined;
    highlightClass: string;
}

export const HighlightSearchAbstract = ({
    abstract,
    searchValue,
    title,
    highlightClass,
}: HighlightSearchAbstractProps) => {
    const terms = getAbstractHighlightTerms(searchValue, title, abstract);

    if (!terms.length) {
        return <>{abstract}</>;
    }

    const pattern = terms.map((term) => `\\b${escapeRegExp(term)}\\b`).join("|");
    const parts = abstract.split(new RegExp(`(${pattern})`, "gi"));

    return (
        <>
            {parts.map((part, index) => {
                const isMatch = terms.some(
                    (term) => part.toLowerCase() === term.toLowerCase(),
                );

                if (isMatch) {
                    return (
                        <mark key={index} className={highlightClass}>
                            {part}
                        </mark>
                    );
                }

                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </>
    );
};
