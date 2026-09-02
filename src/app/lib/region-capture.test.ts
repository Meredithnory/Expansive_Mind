import { describe, expect, it } from "vitest";
import {
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
