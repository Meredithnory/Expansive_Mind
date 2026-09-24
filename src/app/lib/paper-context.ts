import type {
    FormattedPaper,
    PaperFigure,
    Section,
} from "../api/general-interfaces";

const MAX_CONTEXT_CHARS = 6_000;
const MAX_ABSTRACT_CHARS = 1_500;
const MAX_SECTION_CHARS = 2_250;
const MAX_FIGURE_CHARS = 1_200;
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

const collectFigures = (sections: Section[]): PaperFigure[] => {
    const figures: PaperFigure[] = [];
    for (const section of sections) {
        for (const figure of section.figures || []) {
            figures.push(figure);
        }
        for (const subSection of section.subSections || []) {
            for (const figure of subSection.figures || []) {
                figures.push(figure);
            }
        }
    }
    return figures;
};

const formatFigureCaption = (figure: PaperFigure) => {
    const title = [figure.label, figure.captionTitle].filter(Boolean).join(". ");
    const body = [title, figure.caption].filter(Boolean).join(". ").trim();
    if (!body) return "";
    const where = [figure.sectionTitle, figure.subSectionTitle]
        .filter(Boolean)
        .join(" / ");
    return where ? `${body} (from ${where})` : body;
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
    const wantsFigures =
        /\b(figure|fig\.?|panel|algorithm|diagram|schematic|illustration)\b/i.test(
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

    const figures =
        paper.figures && paper.figures.length > 0
            ? paper.figures
            : collectFigures(paper.paper);
    const figureCaptions = figures.map(formatFigureCaption).filter(Boolean);
    // Put figure captions early so the context budget cannot truncate them
    // when the user is asking about a figure.
    if (figureCaptions.length > 0 && wantsFigures) {
        parts.push(
            `## Figures in this paper (captions only; images may not be in these excerpts)\n${truncateAtSentence(
                figureCaptions
                    .map((caption, index) => `${index + 1}. ${caption}`)
                    .join(" "),
                MAX_FIGURE_CHARS,
            )}`,
        );
    } else if (figures.length === 0 && wantsFigures) {
        parts.push(
            "## Figures in this paper\nNo figure captions are present in the licensed text supplied for this paper.",
        );
    }

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

    return capContext(parts.join("\n\n"), MAX_CONTEXT_CHARS);
};

/** Keeps section headings on their own lines. Sentence trimming is for section bodies only. */
function capContext(text: string, limit: number) {
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const paragraph = slice.lastIndexOf("\n\n");
    const sentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! "),
    );
    const breakAt = Math.max(paragraph, sentence);
    const cut = breakAt > limit * 0.6 ? breakAt : limit;
    return `${text.slice(0, cut).trim()}…`;
}
