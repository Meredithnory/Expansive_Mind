import type { FormattedPaper, PaperFigure } from "../api/general-interfaces";
import { truncateAtSentence } from "./paper-context";

/**
 * Paper context for reader chat. Unlike selectPaperContext (shared with
 * Discover and briefs, left unchanged), this ranks individual passages
 * instead of whole sections, reads subsections, ignores filler words, and
 * leans on the previous question when a follow-up is too short to search.
 */

const MAX_CONTEXT_CHARS = 12_000;
const MAX_PASSAGE_CHARS = 1_400;
const MAX_ABSTRACT_CHARS = 900;
const MAX_FIGURE_CHARS = 1_200;
const EXCLUDED_SECTION_TITLES =
    /references|bibliography|acknowledg|author information|conflict of interest|funding|data availability|supplementary/i;

const STOPWORDS = new Set(
    (
        "the and for are but not you all any can had her was one our out has have " +
        "how its may who what when where which why with this that these those from " +
        "into about does did doing done they them their there then than also just " +
        "more most some such only very your yours will would could should might " +
        "been being were is it of to in on at by as or an be do if so me my we us " +
        "paper study article authors author show shows shown tell explain please " +
        "mean means say says thing things like know need want"
    ).split(" "),
);

type Intent = "methods" | "results" | "limitations" | "overview" | null;

const INTENT_PATTERNS: Array<[Exclude<Intent, null>, RegExp, RegExp]> = [
    [
        "methods",
        /\b(method|protocol|assay|procedure|design|sample size|participants?|cohort|dose|dosing|measured|statistic|analysis|model|mice|patients|inclusion|exclusion|search strategy|how did they)\b/i,
        /method|material|experimental|design|statistic|procedure|participant|protocol/i,
    ],
    [
        "results",
        /\b(result|finding|found|effect|outcome|significant|increase|decrease|improve|compared|difference|p ?[<=]|odds|hazard)\b/i,
        /result|finding|outcome/i,
    ],
    [
        "limitations",
        /\b(limitation|weakness|bias|caveat|confound|generaliz|future|next step|not repeat|flaw|gap)\b/i,
        /limitation|discussion|conclusion|future/i,
    ],
    [
        "overview",
        /\b(summar|overview|main point|takeaway|tl;?dr|about|gist|key finding|conclusion)\b/i,
        /abstract|conclusion|discussion|summary/i,
    ],
];

const stem = (term: string) =>
    term.length > 4 ? term.replace(/(ing|ed|es|s)$/, "") : term;

export function queryTerms(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .map((term) => term.replace(/^-+|-+$/g, ""))
        .filter((term) => term.length > 1 && !STOPWORDS.has(term))
        .map(stem);
}

function detectIntent(question: string): {
    intent: Intent;
    sectionPattern: RegExp | null;
} {
    for (const [intent, askPattern, sectionPattern] of INTENT_PATTERNS) {
        if (askPattern.test(question)) return { intent, sectionPattern };
    }
    return { intent: null, sectionPattern: null };
}

interface Passage {
    order: number;
    section: string;
    subSection: string;
    text: string;
    terms: Map<string, number>;
}

function splitIntoPassages(text: string): string[] {
    const normalized = text.replace(/\r/g, "");
    const paragraphs = normalized
        .split(/\n\s*\n/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean);
    const passages: string[] = [];
    for (const paragraph of paragraphs) {
        if (paragraph.length <= MAX_PASSAGE_CHARS) {
            passages.push(paragraph);
            continue;
        }
        // Long paragraphs: window by sentences so a relevant sentence deep in
        // a section can still be picked.
        const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [
            paragraph,
        ];
        let current = "";
        for (const sentence of sentences) {
            if ((current + sentence).length > MAX_PASSAGE_CHARS && current) {
                passages.push(current.trim());
                current = "";
            }
            current += sentence;
        }
        if (current.trim()) passages.push(current.trim());
    }
    return passages;
}

function buildPassages(paper: FormattedPaper): Passage[] {
    const passages: Passage[] = [];
    let order = 0;
    const add = (section: string, subSection: string, text: string) => {
        for (const chunk of splitIntoPassages(text || "")) {
            const terms = new Map<string, number>();
            for (const term of queryTerms(chunk)) {
                terms.set(term, (terms.get(term) || 0) + 1);
            }
            passages.push({ order: order++, section, subSection, text: chunk, terms });
        }
    };
    for (const section of paper.paper) {
        const title = section.title?.trim() || "Paper";
        if (EXCLUDED_SECTION_TITLES.test(title)) continue;
        if (/abstract/i.test(title)) continue;
        add(title, "", section.content);
        for (const subSection of section.subSections || []) {
            add(title, subSection.title?.trim() || "", subSection.content);
        }
    }
    return passages;
}

function scorePassages(
    passages: Passage[],
    terms: Array<{ term: string; weight: number }>,
    sectionPattern: RegExp | null,
) {
    const documentFrequency = new Map<string, number>();
    for (const { term } of terms) {
        documentFrequency.set(
            term,
            passages.filter((passage) => passage.terms.has(term)).length,
        );
    }
    const total = Math.max(passages.length, 1);
    return passages.map((passage) => {
        let score = 0;
        for (const { term, weight } of terms) {
            const tf = passage.terms.get(term) || 0;
            if (!tf) continue;
            const idf = Math.log(1 + total / (documentFrequency.get(term) || 1));
            score += weight * idf * (tf / (tf + 1.2));
        }
        if (
            sectionPattern &&
            sectionPattern.test(`${passage.section} ${passage.subSection}`)
        ) {
            score = score * 1.5 + 0.6;
        }
        return { passage, score };
    });
}

function collectFigures(paper: FormattedPaper): PaperFigure[] {
    if (paper.figures && paper.figures.length > 0) return paper.figures;
    const figures: PaperFigure[] = [];
    for (const section of paper.paper) {
        figures.push(...(section.figures || []));
        for (const subSection of section.subSections || []) {
            figures.push(...(subSection.figures || []));
        }
    }
    return figures;
}

function figureBlock(paper: FormattedPaper) {
    const captions = collectFigures(paper)
        .map((figure) => {
            const title = [figure.label, figure.captionTitle].filter(Boolean).join(". ");
            const body = [title, figure.caption].filter(Boolean).join(". ").trim();
            const where = [figure.sectionTitle, figure.subSectionTitle]
                .filter(Boolean)
                .join(" / ");
            return body ? (where ? `${body} (from ${where})` : body) : "";
        })
        .filter(Boolean);
    if (captions.length === 0) {
        return "## Figures in this paper\nNo figure captions are present in the licensed text supplied for this paper.";
    }
    return `## Figures in this paper (captions only; images may not be in these excerpts)\n${truncateAtSentence(
        captions.map((caption, index) => `${index + 1}. ${caption}`).join(" "),
        MAX_FIGURE_CHARS,
    )}`;
}

export function selectChatContext(
    paper: FormattedPaper,
    question: string,
    previousQuestion = "",
): string {
    const current = queryTerms(question);
    const weighted = current.map((term) => ({ term, weight: 1 }));
    // Short follow-ups ("and the second one?") carry few search words; borrow
    // the previous question's terms at lower weight.
    if (current.length < 3 && previousQuestion) {
        for (const term of queryTerms(previousQuestion)) {
            if (!current.includes(term)) weighted.push({ term, weight: 0.5 });
        }
    }
    const { intent, sectionPattern } = detectIntent(`${question} ${previousQuestion}`);
    const wantsFigures = /\b(figure|fig\.?|panel|table|diagram|schematic|chart|graph)\b/i.test(
        question,
    );

    const parts: string[] = [];
    let budget = MAX_CONTEXT_CHARS;
    const push = (text: string) => {
        parts.push(text);
        budget -= text.length + 2;
    };

    if (wantsFigures) push(figureBlock(paper));

    const abstractSection = paper.paper.find((section) =>
        /abstract/i.test(section.title),
    );
    const abstract = abstractSection?.content || paper.abstract || "";
    if (abstract && intent !== "methods") {
        push(`## Abstract\n${truncateAtSentence(abstract, MAX_ABSTRACT_CHARS)}`);
    }

    const passages = buildPassages(paper);
    const ranked = scorePassages(passages, weighted, sectionPattern)
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);
    // Nothing matched (e.g. "what is this about?"): fall back to the opening
    // passages of each section so the model still sees the paper's spine.
    const picks = ranked.length > 0
        ? ranked.map(({ passage }) => passage)
        : passages.filter(
              (passage, index, all) =>
                  index === 0 || all[index - 1].section !== passage.section,
          );

    const chosen: Passage[] = [];
    for (const passage of picks) {
        if (passage.text.length + 40 > budget) continue;
        chosen.push(passage);
        budget -= passage.text.length + 40;
        if (budget < 200) break;
    }

    // Present in paper order under real section titles, so cite blocks can
    // name the section and quotes stay findable in the reader.
    chosen.sort((a, b) => a.order - b.order);
    let lastSection = "";
    let lastSubSection = "";
    const body: string[] = [];
    for (const passage of chosen) {
        if (passage.section !== lastSection) {
            body.push(`## ${passage.section}`);
            lastSection = passage.section;
            lastSubSection = "";
        }
        if (passage.subSection && passage.subSection !== lastSubSection) {
            body.push(`### ${passage.subSection}`);
        }
        lastSubSection = passage.subSection;
        body.push(passage.text);
    }
    if (body.length > 0) parts.push(body.join("\n\n"));

    return parts.join("\n\n");
}
