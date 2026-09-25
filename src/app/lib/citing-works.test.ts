import { describe, expect, it } from "vitest";
import {
    citingWorkIdentity,
    citingWorksTruncatedNote,
    extractScholarCitesId,
    formatCitingAuthors,
    mergeCitingWorks,
    parseScholarCitesId,
    resolveScholarCitesId,
    type CitingWork,
} from "./citing-works";

function work(
    partial: Partial<CitingWork> & Pick<CitingWork, "title">,
): CitingWork {
    return {
        authors: [],
        ...partial,
    };
}

describe("citing-works helpers", () => {
    it("parses scholar cites ids from the field and cited_by link", () => {
        expect(parseScholarCitesId("1234567890123456789")).toBe(
            "1234567890123456789",
        );
        expect(
            extractScholarCitesId({
                inline_links: {
                    cited_by: {
                        cites_id: "998877665544",
                    },
                },
            }),
        ).toBe("998877665544");
        expect(
            extractScholarCitesId({
                inline_links: {
                    cited_by: {
                        link: "https://scholar.google.com/scholar?cites=445566778899&as_sdt=2005",
                    },
                },
            }),
        ).toBe("445566778899");
    });

    it("rejects invented or tiny ids", () => {
        expect(parseScholarCitesId("abc")).toBeUndefined();
        expect(parseScholarCitesId("")).toBeUndefined();
        expect(parseScholarCitesId(null)).toBeUndefined();
    });

    it("falls back to Scholar cluster id when cites id was not stored", () => {
        expect(
            resolveScholarCitesId({
                scholarCitesId: "998877665544",
                database: "scholar",
                idName: "cluster_id",
                paperId: "17538697489082884675",
            }),
        ).toBe("998877665544");
        expect(
            resolveScholarCitesId({
                database: "scholar",
                idName: "cluster_id",
                paperId: "17538697489082884675",
            }),
        ).toBe("17538697489082884675");
        expect(
            resolveScholarCitesId({
                database: "nih",
                idName: "pmcid",
                paperId: "1234567",
            }),
        ).toBeUndefined();
    });

    it("formats citing authors without inventing names", () => {
        expect(formatCitingAuthors([])).toBe("Authors not listed");
        expect(formatCitingAuthors(["A. One", "B. Two", "C. Three"])).toBe(
            "A. One, B. Two et al.",
        );
    });

    it("merges pages, appending new works and dropping duplicates", () => {
        const page1 = [
            work({ title: "Alpha", doi: "10.1/a" }),
            work({ title: "Beta", clusterId: "111" }),
        ];
        const page2 = [
            work({ title: "Alpha again", doi: "10.1/a" }),
            work({ title: "Beta", clusterId: "111" }),
            work({ title: "Gamma" }),
            work({ title: "Delta", doi: "10.1/d" }),
        ];
        const merged = mergeCitingWorks(page1, page2);
        expect(merged.map((row) => row.title)).toEqual([
            "Alpha",
            "Beta",
            "Gamma",
            "Delta",
        ]);
        expect(merged).toHaveLength(4);
    });

    it("identifies works by doi, then cluster, then title", () => {
        expect(
            citingWorkIdentity(work({ title: "T", doi: "10.1/X" })),
        ).toBe("doi:10.1/x");
        expect(
            citingWorkIdentity(work({ title: "T", clusterId: "99" })),
        ).toBe("cluster:99");
        expect(citingWorkIdentity(work({ title: " Unique Title " }))).toBe(
            "title:unique title",
        );
    });

    it("stops pagination notes when exhausted below reported total", () => {
        expect(citingWorksTruncatedNote(10, 15, false)).toBe(
            "Index returned 10 of 15 citing papers.",
        );
        expect(citingWorksTruncatedNote(15, 15, false)).toBeUndefined();
        expect(citingWorksTruncatedNote(10, 15, true)).toBeUndefined();
    });
});
