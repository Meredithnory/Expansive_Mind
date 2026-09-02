import React from "react";

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};
