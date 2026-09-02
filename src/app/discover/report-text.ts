export type CitedSegment =
    | { type: "text"; value: string }
    | { type: "cite"; index: number; label: string };

const CITATION_PATTERN = /\[Paper\s+(\d+)\]|\bPaper\s+(\d+)/gi;

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
        const indexText = match[1] ?? match[2];
        const index = Number.parseInt(indexText, 10);
        const start = match.index ?? 0;
        if (start > lastIndex) {
            pushText(content.slice(lastIndex, start));
        }
        if (Number.isFinite(index) && index >= 1 && index <= paperCount) {
            segments.push({
                type: "cite",
                index,
                label: `Paper ${index}`,
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
