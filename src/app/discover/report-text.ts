export type CitedSegment =
    | { type: "text"; value: string }
    | { type: "cite"; index: number; label: string };

// Report prose cites papers in whatever shape the model wrote them:
// "[Paper 3]", "[Papers 2, 5]", "[1,6,9]", "[10]", "[Papers 7–9]", and in
// older briefs a bare "Paper 3" or "Papers 2 and 5". All become chips.
const NUMBER_LIST = String.raw`\d{1,3}(?:\s*(?:,|;|&|\band\b|–|—|-)\s*(?:and\s+)?\d{1,3})*`;
const CITATION_PATTERN = new RegExp(
    String.raw`\[\s*(?:Papers?\s+)?(${NUMBER_LIST})\s*\]|\bPapers\s+(${NUMBER_LIST})|\bPaper\s+(\d{1,3})\b`,
    "gi",
);

/** "1, 6 and 10" → [1, 6, 10]; "7–9" → [7, 8, 9]. Empty if any part isn't a number. */
function citationNumbers(list: string): number[] {
    const numbers: number[] = [];
    for (const part of list.split(/\s*(?:,|;|&|\band\b)\s*/i)) {
        const item = part.trim();
        if (!item) continue;
        const range = /^(\d{1,3})\s*[–—-]\s*(\d{1,3})$/.exec(item);
        if (range) {
            const from = Number(range[1]);
            const to = Number(range[2]);
            if (to < from || to - from > 20) return [];
            for (let number = from; number <= to; number += 1) numbers.push(number);
        } else if (/^\d{1,3}$/.test(item)) {
            numbers.push(Number(item));
        } else {
            return [];
        }
    }
    return [...new Set(numbers)];
}

export function splitCitedText(
    content: string,
    paperCount: number,
): CitedSegment[] {
    const segments: CitedSegment[] = [];
    const pushText = (value: string) => {
        if (!value) return;
        const last = segments[segments.length - 1];
        if (last?.type === "text") {
            last.value += value;
            return;
        }
        segments.push({ type: "text", value });
    };

    let lastIndex = 0;
    for (const match of content.matchAll(CITATION_PATTERN)) {
        const start = match.index ?? 0;
        if (start > lastIndex) {
            pushText(content.slice(lastIndex, start));
        }
        const numbers = citationNumbers(match[1] ?? match[2] ?? match[3] ?? "");
        const valid =
            numbers.length > 0 &&
            numbers.every((index) => index >= 1 && index <= paperCount);
        if (valid) {
            numbers.forEach((index, position) => {
                if (position > 0) pushText(" ");
                segments.push({ type: "cite", index, label: `Paper ${index}` });
            });
        } else {
            pushText(match[0]);
        }
        lastIndex = start + match[0].length;
    }
    if (lastIndex < content.length) {
        pushText(content.slice(lastIndex));
    }
    return segments.length > 0
        ? segments
        : [{ type: "text", value: content }];
}

export function splitParagraphs(text: string): string[] {
    return text
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}
