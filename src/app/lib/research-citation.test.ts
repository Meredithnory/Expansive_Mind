import { describe, expect, it } from "vitest";
import { makePaperLocator } from "./paper-sources";
import {
    doiUrl,
    locatorFromPmcid,
    mergeCitations,
    normalizeCitation,
    normalizeDoi,
    normalizePmcid,
    workKey,
} from "./research-citation";

describe("normalizeDoi", () => {
    it("strips doi: and doi.org prefixes", () => {
        expect(normalizeDoi("doi:10.1186/s41073-026-00245-8")).toBe(
            "10.1186/s41073-026-00245-8",
        );
        expect(normalizeDoi("https://doi.org/10.1007/s43681-026-01254-5")).toBe(
            "10.1007/s43681-026-01254-5",
        );
        expect(normalizeDoi("DOI: 10.1038/s41586-020-0001-1")).toBe(
            "10.1038/s41586-020-0001-1",
        );
    });

    it("rejects non-DOI strings", () => {
        expect(normalizeDoi("PMC1234567")).toBeNull();
        expect(normalizeDoi("")).toBeNull();
        expect(normalizeDoi("not-a-doi")).toBeNull();
    });
});

describe("normalizePmcid", () => {
    it("strips PMC prefix", () => {
        expect(normalizePmcid("PMC1234567")).toBe("1234567");
        expect(normalizePmcid("pmc 1234567")).toBe("1234567");
    });
});

describe("normalizeCitation / mergeCitations / workKey", () => {
    it("fills Untitled and drops empty authors", () => {
        const citation = normalizeCitation({
            authors: ["  Ada  ", "", null],
            doi: "https://doi.org/10.1000/xyz",
        });
        expect(citation.title).toBe("Untitled");
        expect(citation.authors).toEqual(["Ada"]);
        expect(citation.doi).toBe("10.1000/xyz");
    });

    it("lets a loaded JATS DOI win over a search row", () => {
        const search = normalizeCitation({ title: "Search title" });
        const loaded = normalizeCitation({
            title: "JATS title",
            doi: "10.1000/from-jats",
        });
        expect(mergeCitations(search, loaded).doi).toBe("10.1000/from-jats");
        expect(mergeCitations(search, loaded).title).toBe("JATS title");
    });

    it("dedupes by DOI before database:paperId", () => {
        expect(
            workKey({
                doi: "https://doi.org/10.1000/Abc",
                locator: makePaperLocator("nih", "123"),
            }),
        ).toBe("doi:10.1000/abc");
        expect(workKey({ locator: makePaperLocator("nih", "123") })).toBe(
            "nih:123",
        );
    });

    it("builds a doi.org URL and a nih locator from PMCID", () => {
        expect(doiUrl("10.1000/xyz")).toBe("https://doi.org/10.1000/xyz");
        expect(locatorFromPmcid("PMC99")).toEqual({
            database: "nih",
            paperId: "99",
            idName: "pmcid",
        });
    });
});
