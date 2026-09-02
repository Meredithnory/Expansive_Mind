import type { FormattedPaper } from "../api/general-interfaces";
import { bestMatchingExcerpt } from "./region-capture";

export interface PaperCitation {
    sectionTitle: string;
    startLine: number;
    endLine: number;
    lines: string[];
}

export interface PaperLine {
    number: number;
    sectionTitle: string;
    text: string;
}

const WRAP_WIDTH = 78;
const CITE_OPEN = ":::cite";
const CITE_CLOSE = ":::";

export function wrapTextToLines(text: string, width = WRAP_WIDTH) {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (words.length === 0) return [] as string[];
    const rows: string[] = [];
    let current = "";
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > width && current) {
            rows.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) rows.push(current);
    return rows;
}

export function buildPaperLines(paper: FormattedPaper): PaperLine[] {
    const lines: PaperLine[] = [];
    let number = 1;
    for (const section of paper.paper) {
        const sectionTitle = section.title?.trim() || "Paper";
        const chunks = [
            section.content,
            ...section.subSections.map(
                (subSection) =>
                    [subSection.title, subSection.content]
                        .filter(Boolean)
                        .join(". "),
            ),
        ];
        for (const chunk of chunks) {
            for (const row of wrapTextToLines(chunk)) {
                lines.push({ number: number++, sectionTitle, text: row });
            }
        }
    }
    return lines;
}

export function isFrontMatterSection(title: string) {
    return /^(abstract|summary|synopsis|graphical abstract)$/i.test(
        title.trim(),
    );
}

const foldCitationText = (value: string) =>
    value
        .replace(/[\u2010-\u2015]/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D"]/g, " ")
        .toLowerCase();

const sectionAtIndex = (lines: PaperLine[], index: number) => {
    let cursor = 0;
    for (const line of lines) {
        const next = cursor + line.text.length + 1;
        if (index >= cursor && index < next) return line.sectionTitle;
        cursor = next;
    }
    return lines[0]?.sectionTitle || "Paper";
};

const scoreExcerptSection = (sectionTitle: string, preferred?: string) => {
    const preferredTitle = preferred?.trim();
    if (preferredTitle && isFrontMatterSection(preferredTitle)) {
        return isFrontMatterSection(sectionTitle) ? 1 : 2;
    }
    if (
        preferredTitle &&
        sectionTitle.toLowerCase() === preferredTitle.toLowerCase()
    ) {
        return 4;
    }
    if (
        preferredTitle &&
        isMethodsSectionTitle(preferredTitle) &&
        isMethodsSectionTitle(sectionTitle)
    ) {
        return 3;
    }
    if (!isFrontMatterSection(sectionTitle)) return 2;
    return 1;
};

const citationFromMatch = (
    lines: PaperLine[],
    index: number,
    matchLength: number,
): PaperCitation | null => {
    const endIndex = index + matchLength;
    let cursor = 0;
    let startLine = lines[0].number;
    let endLine = lines[0].number;
    let sectionTitle = lines[0].sectionTitle;
    for (const line of lines) {
        const next = cursor + line.text.length + 1;
        if (index >= cursor && index < next) {
            startLine = line.number;
            sectionTitle = line.sectionTitle;
        }
        if (endIndex > cursor) endLine = line.number;
        cursor = next;
    }
    const cited = lines.filter(
        (line) => line.number >= startLine && line.number <= endLine,
    );
    if (cited.length === 0) return null;
    return {
        sectionTitle,
        startLine,
        endLine,
        lines: cited.map((line) => line.text),
    };
};

export function locateExcerptInPaper(
    paper: FormattedPaper,
    excerpt: string,
    fallbackSection = "Paper",
): PaperCitation {
    const needle = excerpt.replace(/\s+/g, " ").trim();
    const lines = buildPaperLines(paper);
    if (!needle) {
        return {
            sectionTitle: fallbackSection,
            startLine: 1,
            endLine: 1,
            lines: [""],
        };
    }

    if (lines.length > 0) {
        const haystack = lines.map((line) => line.text).join(" ");
        const matched = bestMatchingExcerpt(haystack, needle);
        const foldedHay = foldCitationText(haystack);
        if (matched) {
            const indexes: number[] = [];
            let from = 0;
            while (from < foldedHay.length) {
                const found = foldedHay.indexOf(matched, from);
                if (found < 0) break;
                indexes.push(found);
                from = found + Math.max(1, matched.length);
            }
            let bestIndex = indexes[0];
            let bestScore = -1;
            for (const index of indexes) {
                const score = scoreExcerptSection(
                    sectionAtIndex(lines, index),
                    fallbackSection,
                );
                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            }
            if (bestIndex >= 0) {
                const citation = citationFromMatch(
                    lines,
                    bestIndex,
                    matched.length,
                );
                if (citation) return citation;
            }
        }
    }

    const wrapped = wrapTextToLines(needle);
    return {
        sectionTitle: fallbackSection,
        startLine: 1,
        endLine: Math.max(1, wrapped.length),
        lines: wrapped.length > 0 ? wrapped : [needle],
    };
}

const METHODS_SECTION =
    /method|materials and methods|experimental procedures|experimental design|study design/i;

export function isMethodsSectionTitle(title: string) {
    return METHODS_SECTION.test(title);
}

export function findMethodsSectionTitle(
    paper: FormattedPaper,
): string | null {
    const match = paper.paper.find((section) =>
        isMethodsSectionTitle(section.title || ""),
    );
    return match?.title?.trim() || null;
}

export function locateMethodInPaper(
    paper: FormattedPaper,
    excerpt?: string | null,
): PaperCitation {
    const methodsTitle = findMethodsSectionTitle(paper);
    const fallback = methodsTitle || "Paper";
    if (excerpt?.trim()) {
        return locateExcerptInPaper(paper, excerpt, fallback);
    }

    const lines = buildPaperLines(paper).filter((line) =>
        methodsTitle ? line.sectionTitle === methodsTitle : true,
    );
    const first = lines[0];
    if (!first) {
        return {
            sectionTitle: fallback,
            startLine: 1,
            endLine: 1,
            lines: [""],
        };
    }
    const window = lines.slice(0, 4);
    return {
        sectionTitle: first.sectionTitle,
        startLine: first.number,
        endLine: window[window.length - 1].number,
        lines: window.map((line) => line.text),
    };
}

export function citationLabel(citation: PaperCitation) {
    if (citation.startLine === citation.endLine) {
        return `${citation.sectionTitle} · ${citation.startLine}`;
    }
    return `${citation.sectionTitle} · ${citation.startLine}–${citation.endLine}`;
}

export function locateStatusLabel(citation: PaperCitation) {
    if (isFrontMatterSection(citation.sectionTitle)) {
        return "Highlighted this passage";
    }
    return `Highlighted in ${citation.sectionTitle}`;
}

export function encodeCitedMessage(
    citations: PaperCitation[],
    question: string,
) {
    const blocks = citations.map((citation) => {
        const header = `${CITE_OPEN}|${citation.sectionTitle.replace(/\|/g, " ")}|${citation.startLine}|${citation.endLine}`;
        return `${header}\n${citation.lines.join("\n")}\n${CITE_CLOSE}`;
    });
    const prompt = question.trim();
    return prompt ? `${blocks.join("\n")}\n${prompt}` : blocks.join("\n");
}

const CITE_OPEN_RE = /:::cite\|/g;
const CITE_CLOSE_RE = /\n?:::(?!cite\b)/;
const LINE_RANGE_RE = /^(\d+)\s*[-–]\s*(\d+)\s*(.*)$/;
const LINE_NUMBER_RE = /^(\d+)\s*(.*)$/;

function parseLineField(value: string): {
    start: number;
    end: number;
    extra: string;
} | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const range = trimmed.match(LINE_RANGE_RE);
    if (range) {
        return {
            start: Number(range[1]),
            end: Number(range[2]),
            extra: range[3].trim(),
        };
    }
    const single = trimmed.match(LINE_NUMBER_RE);
    if (!single) return null;
    const n = Number(single[1]);
    return { start: n, end: n, extra: single[2].trim() };
}

function splitCiteHeader(rest: string): {
    sectionTitle: string;
    startLine: number;
    endLine: number;
    inlineQuote: string;
} {
    const parts = rest.split("|");
    const sectionTitle = (parts[0] || "Paper").trim() || "Paper";
    const first = parseLineField(parts[1] || "");
    const second = parseLineField(parts[2] || "");
    const leftover = parts.slice(3).join("|").trim();
    let startLine = 1;
    let endLine = 1;
    let extra = "";
    if (first && second) {
        startLine = first.start;
        endLine = second.end;
        extra = second.extra;
    } else if (first) {
        startLine = first.start;
        endLine = first.end;
        extra = first.extra;
    }
    const inlineQuote = [extra, leftover]
        .filter(Boolean)
        .join(" ")
        .replace(/^["“]|["”]$/g, "")
        .trim();
    return { sectionTitle, startLine, endLine, inlineQuote };
}

function citationLinesFromBody(body: string, fallback: string, span: number) {
    const lines = body
        .split("\n")
        .map((line) => line.trim().replace(/^["“]|["”]$/g, ""))
        .filter(Boolean);
    if (lines.length > 0) return lines;
    if (fallback) return [fallback];
    return Array.from({ length: Math.max(1, span) }, () => "");
}

export function parseCitedMessage(message: string): {
    citations: PaperCitation[];
    question: string;
} {
    const citations: PaperCitation[] = [];
    const proseParts: string[] = [];
    let cursor = 0;
    CITE_OPEN_RE.lastIndex = 0;
    let match = CITE_OPEN_RE.exec(message);

    while (match) {
        if (match.index > cursor) {
            proseParts.push(message.slice(cursor, match.index));
        }

        const headerEnd = message.indexOf("\n", match.index);
        const headerLine =
            headerEnd === -1
                ? message.slice(match.index)
                : message.slice(match.index, headerEnd);
        const header = splitCiteHeader(headerLine.slice(CITE_OPEN.length + 1));
        const afterHeader = headerEnd === -1 ? "" : message.slice(headerEnd + 1);
        const closeMatch = afterHeader.match(CITE_CLOSE_RE);
        const nextCite = afterHeader.search(/:::cite\|/);
        const headerConsumed =
            headerEnd === -1 ? message.length : headerEnd + 1;
        let body = "";
        let consumed = headerConsumed;

        if (closeMatch && closeMatch.index !== undefined) {
            const closeAt = closeMatch.index;
            const nextIsEarlier = nextCite >= 0 && nextCite < closeAt;
            if (!nextIsEarlier) {
                body = afterHeader.slice(0, closeAt);
                consumed = headerConsumed + closeAt + closeMatch[0].length;
            } else {
                body = afterHeader.slice(0, nextCite);
                consumed = headerConsumed + nextCite;
            }
        } else if (header.inlineQuote) {
            consumed = headerConsumed;
        } else if (nextCite >= 0) {
            body = afterHeader.slice(0, nextCite);
            consumed = headerConsumed + nextCite;
        } else {
            const blank = afterHeader.search(/\n\s*\n/);
            if (blank >= 0) {
                body = afterHeader.slice(0, blank);
                consumed = headerConsumed + blank;
            } else {
                body = afterHeader;
                consumed = message.length;
            }
        }

        citations.push({
            sectionTitle: header.sectionTitle,
            startLine: header.startLine,
            endLine: header.endLine,
            lines: citationLinesFromBody(
                body,
                header.inlineQuote,
                header.endLine - header.startLine + 1,
            ),
        });

        cursor = consumed;
        CITE_OPEN_RE.lastIndex = cursor;
        match = CITE_OPEN_RE.exec(message);
    }

    if (cursor < message.length) {
        proseParts.push(message.slice(cursor));
    }

    const question = proseParts
        .join("\n")
        .replace(/:::cite\|[^\n]*/g, "")
        .replace(/(^|\n):::(?!\S)/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { citations, question };
}

const MAX_PREVIEW = 8;

export function citationPreviewRows(citation: PaperCitation) {
    const numbered = citation.lines.map((text, index) => ({
        number: citation.startLine + index,
        text,
        ellipsis: false,
    }));
    if (numbered.length <= MAX_PREVIEW) return numbered;
    const head = numbered.slice(0, 4);
    const tail = numbered.slice(-3);
    return [
        ...head,
        { number: 0, text: "…", ellipsis: true },
        ...tail,
    ];
}
