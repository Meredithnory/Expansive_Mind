import { describe, expect, it } from "vitest";
import {
    snapOffsetsToWords,
    bestMatchingExcerpt,
    formatExcerptQuestion,
    locateNormalizedExcerpt,
} from "./region-capture";

describe("excerpt question formatting", () => {
    it("quotes the selected text so chat can focus on that passage", () => {
        expect(formatExcerptQuestion("What is n?", "  Sample size was 42.  ")).toBe(
            `Regarding this selected excerpt from the paper:\n\n"""\nSample size was 42.\n"""\n\nWhat is n?`,
        );
    });

    it("uses a default question when the composer is empty", () => {
        expect(formatExcerptQuestion("  ", "The hazard ratio was 0.8.")).toContain(
            "What does this selected excerpt mean?",
        );
    });
});

describe("excerpt location in paper text", () => {
    it("maps a normalized excerpt back onto original text nodes", () => {
        expect(
            locateNormalizedExcerpt(
                [{ text: "  Sample   size was 42.  " }, { text: " Next." }],
                "sample size was 42.",
            ),
        ).toEqual({
            startPieceIndex: 0,
            startOffset: 2,
            endPieceIndex: 0,
            endOffset: 23,
        });
    });

    it("can span multiple text nodes", () => {
        expect(
            locateNormalizedExcerpt(
                [{ text: "The hazard " }, { text: "ratio was 0.8." }],
                "hazard ratio was 0.8",
            ),
        ).toEqual({
            startPieceIndex: 0,
            startOffset: 4,
            endPieceIndex: 1,
            endOffset: 13,
        });
    });

    it("reads a paragraph boundary as a word break", () => {
        expect(
            locateNormalizedExcerpt(
                [
                    { text: "Methods", blockStart: true },
                    { text: "We enrolled 40 mice.", blockStart: true },
                ],
                "Methods We enrolled 40 mice.",
            ),
        ).toEqual({
            startPieceIndex: 0,
            startOffset: 0,
            endPieceIndex: 1,
            endOffset: 20,
        });
    });

    it("returns null when the excerpt is not in the paper", () => {
        expect(
            locateNormalizedExcerpt(
                [{ text: "No overlap here." }],
                "hazard ratio",
            ),
        ).toBeNull();
    });

    it("matches a slightly messy assistant quote to the real sentence", () => {
        const paper =
            "A systematic literature review was conducted across PubMed and Scopus.";
        expect(
            bestMatchingExcerpt(
                paper,
                'The authors wrote: "A systematic literature review was conducted across PubMed"',
            ),
        ).toBe("a systematic literature review was conducted across pubmed");
        expect(
            locateNormalizedExcerpt(
                [{ text: paper }],
                "A systematic literature review was conducted across PubMed",
            ),
        ).toMatchObject({
            startPieceIndex: 0,
            startOffset: 0,
        });
    });
});

describe("snapOffsetsToWords", () => {
    const text = "coding, analysis, interpretation, manuscript drafting";

    it("finishes a word the selection stopped inside", () => {
        const start = text.indexOf("analysis");
        const cut = text.indexOf("interpretation") + 4; // "inte|rpretation"
        const snapped = snapOffsetsToWords(text, start, text, cut);
        expect(text.slice(snapped.start, snapped.end)).toBe(
            "analysis, interpretation",
        );
    });

    it("starts at the beginning of a word the selection began inside", () => {
        const start = text.indexOf("analysis") + 3; // "ana|lysis"
        const end = text.indexOf(",", start);
        const snapped = snapOffsetsToWords(text, start, text, end);
        expect(text.slice(snapped.start, snapped.end)).toBe("analysis");
    });

    it("leaves edges that already fall between words", () => {
        const start = text.indexOf("analysis");
        const end = text.indexOf("analysis") + "analysis,".length;
        expect(snapOffsetsToWords(text, start, text, end)).toEqual({
            start,
            end,
        });
    });

    it("works across two text nodes", () => {
        const first = "the framework distin";
        const second = "guishes disclosure from docu";
        const snapped = snapOffsetsToWords(first, 4, second, second.length - 2);
        expect(snapped).toEqual({ start: 4, end: second.length });
    });
});
