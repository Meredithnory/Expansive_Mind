// Citation chips are parsed in src/app/lib/cited-text.ts, shared with the
// server step that records which evidence each chip points to.
export { splitCitedText, type CitedSegment } from "../lib/cited-text";

export function splitParagraphs(text: string): string[] {
    return text
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}
