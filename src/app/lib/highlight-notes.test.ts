import { describe, expect, it } from "vitest";
import {
    groupHighlightsByPaper,
    highlightPaperKey,
    type HighlightNoteRow,
} from "./highlight-notes";

const citation = { sectionTitle: "Results", startLine: 1, endLine: 1, lines: ["x"] };

function row(over: Partial<HighlightNoteRow>): HighlightNoteRow {
    return {
        id: "h",
        excerpt: "text",
        citation,
        color: "pink",
        createdAt: "2026-09-01T00:00:00.000Z",
        primarySource: "Springer Nature",
        paperId: "10.1186/abc",
        idName: "doi",
        ...over,
    };
}

describe("groupHighlightsByPaper", () => {
    it("groups by paper, newest paper first, notes in reading order", () => {
        const papers = groupHighlightsByPaper([
            row({ id: "s2", createdAt: "2026-09-03T00:00:00.000Z" }),
            row({ id: "s1", createdAt: "2026-09-02T00:00:00.000Z" }),
            row({
                id: "n1",
                primarySource: "NIH PubMed Central",
                paperId: "123",
                idName: "pmcid",
                createdAt: "2026-09-05T00:00:00.000Z",
            }),
        ]);
        expect(papers.map((paper) => paper.paperId)).toEqual(["123", "10.1186/abc"]);
        expect(papers[1].highlights.map((h) => h.id)).toEqual(["s1", "s2"]);
        expect(papers[1].href).toBe("/paperchatbot/springer/10.1186/abc");
        expect(papers[0].database).toBe("nih");
    });

    it("uses a looked-up title and falls back to source and id", () => {
        const withTitle = row({});
        const titles = new Map([[highlightPaperKey(withTitle), "A real title"]]);
        expect(groupHighlightsByPaper([withTitle], titles)[0].title).toBe("A real title");
        expect(groupHighlightsByPaper([withTitle])[0].title).toBe(
            "Springer Nature · 10.1186/abc",
        );
    });

    it("skips rows from an unknown source and strips locator fields", () => {
        const papers = groupHighlightsByPaper([
            row({ primarySource: "Somewhere else" }),
            row({ id: "keep" }),
        ]);
        expect(papers).toHaveLength(1);
        expect(papers[0].highlights[0]).not.toHaveProperty("paperId");
    });
});
