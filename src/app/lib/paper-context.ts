import type { FormattedPaper } from "../api/general-interfaces";

const MAX_CONTEXT_CHARS = 6_000;
const MAX_ABSTRACT_CHARS = 1_500;
const MAX_SECTION_CHARS = 2_250;
const EXCLUDED_SECTION_TITLES =
    /references|bibliography|acknowledg|author information|conflict of interest/i;

export const truncateAtSentence = (text: string, limit: number) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) return normalized;
    const slice = normalized.slice(0, limit);
    const sentenceEnd = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! "),
    );
    return `${slice.slice(0, sentenceEnd > limit * 0.6 ? sentenceEnd + 1 : limit).trim()}…`;
};

export const selectPaperContext = (
    paper: FormattedPaper,
    question: string,
) => {
    const queryTerms = new Set(
        question
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .split(/\s+/)
            .filter((term) => term.length > 2),
    );
    const wantsMethods =
        /\b(method|protocol|assay|procedure|search strategy|databases?|eligibility|inclusion)\b/i.test(
            question,
        );
    const abstractSection = paper.paper.find((section) =>
        section.title.toLowerCase().includes("abstract"),
    );
    const candidates = paper.paper
        .filter(
            (section) =>
                section !== abstractSection &&
                !EXCLUDED_SECTION_TITLES.test(section.title),
        )
        .map((section) => {
            const haystack =
                `${section.title} ${section.content}`.toLowerCase();
            const score = Array.from(queryTerms).filter((term) =>
                haystack.includes(term),
            ).length;
            return { section, score };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);

    const parts: string[] = [];
    const abstract = abstractSection?.content || paper.abstract;
    const hasMethodsCandidate = candidates.some((item) =>
        /method|materials|experimental|study design|search strategy/i.test(
            item.section.title,
        ),
    );
    if (abstract && !(wantsMethods && hasMethodsCandidate)) {
        parts.push(
            `## Abstract\n${truncateAtSentence(abstract, MAX_ABSTRACT_CHARS)}`,
        );
    }
    for (const { section } of candidates) {
        parts.push(
            `## ${section.title}\n${truncateAtSentence(section.content, MAX_SECTION_CHARS)}`,
        );
    }
    return truncateAtSentence(parts.join("\n\n"), MAX_CONTEXT_CHARS);
};

/** Body-only excerpt for claim-ledger quotes. Never uses Abstract. */
export function selectQuotableExcerpt(
    paper: FormattedPaper,
    question: string,
    maxChars = 600,
): string {
    const body = paper.paper.filter(
        (section) => !section.title.toLowerCase().includes("abstract"),
    );
    if (body.length === 0) return "";
    return truncateAtSentence(
        selectPaperContext({ ...paper, paper: body, abstract: "" }, question),
        maxChars,
    );
}
