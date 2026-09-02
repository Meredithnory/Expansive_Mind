import { describe, expect, it } from "vitest";
import {
    parseHighlightCitation,
    parseHighlightExcerpt,
    parseHighlightLookup,
    serializePaperHighlight,
} from "./paper-highlights";

describe("parseHighlightLookup", () => {
    it("normalizes a paper identity for the signed-in user", () => {
        expect(
            parseHighlightLookup({
                database: "nih",
                paperId: "PMC1234567",
                idName: "pmcid",
            }),
        ).toEqual({
            database: "nih",
            primarySource: "NIH PubMed Central",
            paperId: "1234567",
            idName: "pmcid",
        });
    });

    it("rejects an unknown database", () => {
        expect(
            parseHighlightLookup({
                database: "pubmed",
                paperId: "123",
            }),
        ).toBeNull();
    });
});

describe("parseHighlightCitation", () => {
    it("accepts a bounded citation payload", () => {
        expect(
            parseHighlightCitation({
                sectionTitle: " Abstract ",
                startLine: 28,
                endLine: 34,
                lines: ["  First line  ", "", "Second line"],
            }),
        ).toEqual({
            sectionTitle: "Abstract",
            startLine: 28,
            endLine: 34,
            lines: ["First line", "Second line"],
        });
    });

    it("rejects inverted line ranges", () => {
        expect(
            parseHighlightCitation({
                sectionTitle: "Abstract",
                startLine: 34,
                endLine: 28,
                lines: ["First line"],
            }),
        ).toBeNull();
    });
});

describe("parseHighlightExcerpt", () => {
    it("collapses whitespace and trims the excerpt", () => {
        expect(parseHighlightExcerpt("  Sample   size was 42.  ")).toBe(
            "Sample size was 42.",
        );
    });
});

describe("serializePaperHighlight", () => {
    it("returns a client record keyed by document id", () => {
        expect(
            serializePaperHighlight({
                _id: { toString: () => "abc123" },
                excerpt: "Sample size was 42.",
                citation: {
                    sectionTitle: "Abstract",
                    startLine: 28,
                    endLine: 28,
                    lines: ["Sample size was 42."],
                },
                createdAt: new Date("2026-08-27T00:00:00.000Z"),
            }),
        ).toEqual({
            id: "abc123",
            excerpt: "Sample size was 42.",
            citation: {
                sectionTitle: "Abstract",
                startLine: 28,
                endLine: 28,
                lines: ["Sample size was 42."],
            },
            createdAt: "2026-08-27T00:00:00.000Z",
        });
    });
});
