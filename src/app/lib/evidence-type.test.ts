import { describe, expect, it } from "vitest";
import {
    evidenceMixLabel,
    evidenceTypeLabel,
    extractionForPaper,
    parseStoredPaperExtraction,
    parseStoredPaperExtractions,
    publicationYear,
    yearRangeLabel,
} from "./evidence-type";

describe("evidenceTypeLabel", () => {
    it("labels known types and falls back to Other", () => {
        expect(evidenceTypeLabel("rct")).toBe("RCT");
        expect(evidenceTypeLabel("in-vitro")).toBe("In vitro");
        expect(evidenceTypeLabel("not-a-type")).toBe("Other");
    });
});

describe("publicationYear and yearRangeLabel", () => {
    it("pulls a four-digit year out of mixed date strings", () => {
        expect(publicationYear("15 Mar 2022")).toBe("2022");
        expect(publicationYear("2019-04-01")).toBe("2019");
        expect(publicationYear("no date")).toBeNull();
    });

    it("collapses a year span", () => {
        expect(yearRangeLabel(["2019", "2025-01", "2022"])).toBe("2019–2025");
        expect(yearRangeLabel(["2024", "April 2024"])).toBe("2024");
        expect(yearRangeLabel([undefined, "n/a"])).toBe("");
    });
});

describe("parseStoredPaperExtraction", () => {
    it("keeps a supporting excerpt and defaults unknown evidence types", () => {
        const parsed = parseStoredPaperExtraction({
            index: "2",
            title: "Example trial",
            sourceLabel: "NIH PMC",
            authors: ["A. Author", ""],
            publicationDate: "2022",
            keyFindings: ["A finding", " "],
            methods: " Mouse model ",
            limitations: ["Small n"],
            openQuestions: ["Durability?"],
            evidenceType: "animal",
            supportingExcerpt: "CAR-T cells failed to persist in solid tumors.",
        });
        expect(parsed).toEqual({
            index: 2,
            title: "Example trial",
            sourceLabel: "NIH PMC",
            authors: ["A. Author"],
            publicationDate: "2022",
            keyFindings: ["A finding"],
            methods: "Mouse model",
            limitations: ["Small n"],
            openQuestions: ["Durability?"],
            evidenceType: "animal",
            supportingExcerpt: "CAR-T cells failed to persist in solid tumors.",
        });
    });

    it("rejects records without an index or title", () => {
        expect(parseStoredPaperExtraction({ title: "Nope" })).toBeNull();
        expect(parseStoredPaperExtraction({ index: 1 })).toBeNull();
    });
});

describe("evidenceMixLabel", () => {
    it("counts types in a stable order", () => {
        expect(
            evidenceMixLabel([
                { evidenceType: "animal" },
                { evidenceType: "rct" },
                { evidenceType: "rct" },
                { evidenceType: "review" },
            ]),
        ).toBe("1 review · 2 RCTs · 1 animal");
    });

    it("returns empty when there is nothing to count", () => {
        expect(evidenceMixLabel([])).toBe("");
        expect(evidenceMixLabel(undefined)).toBe("");
    });
});

describe("extractionForPaper", () => {
    it("finds the extraction for a paper index", () => {
        const extractions = parseStoredPaperExtractions([
            { index: 1, title: "One" },
            { index: 3, title: "Three", evidenceType: "rct" },
        ]);
        expect(extractionForPaper(extractions, 3)?.title).toBe("Three");
        expect(extractionForPaper(extractions, 2)).toBeUndefined();
    });
});
