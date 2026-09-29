import { describe, expect, it } from "vitest";
import {
    normalizeAbstract,
    resultAccess,
    resultCountLabel,
    resultOpenLabel,
    resultSourceLink,
    resultSourceName,
    resultYear,
    searchesLeftLabel,
    shortAuthors,
    sourcesDownNotice,
} from "./search-result-view";

describe("search result rows", () => {
    it("flattens every abstract shape to plain text", () => {
        expect(normalizeAbstract(null)).toBe("");
        expect(normalizeAbstract(["First part.", "Second part."])).toBe(
            "First part. Second part.",
        );
        expect(
            normalizeAbstract({ "@pub-type": "ppub", p: ["Events  fell.", { "#text": "A lot." }] }),
        ).toBe("Events fell. A lot.");
    });

    it("only promises paper chat when the license clears it", () => {
        const open = { source: "nature" as const, access: { canSendToAI: true, canDisplayFullText: true } };
        expect(resultAccess(open)).toEqual({ label: "Full text + AI", full: true });
        expect(resultOpenLabel(open)).toBe("Open paper chat");

        const closed = { source: "nature" as const, abstract: "Events fell.", access: { canSendToAI: false } };
        expect(resultAccess(closed)).toEqual({ label: "Abstract", full: false });
        expect(resultOpenLabel(closed)).toBe("Open paper");
    });

    it("labels rows whose access is only known once opened", () => {
        expect(resultAccess({ source: "nih" }).label).toBe("License checked on open");
        expect(resultAccess({ source: "scholar" }).label).toBe("Full text checked on open");
        expect(resultAccess({ source: "crossref" }).label).toBe("Metadata only");
        expect(
            resultAccess({ source: "europepmc", abstract: "x", contentLabel: "Search snippet" }).label,
        ).toBe("Search snippet");
    });

    it("links out only to an http source the reader can't show", () => {
        expect(resultSourceLink({ sourceUrl: "https://doi.org/10.1/x" })).toBe("https://doi.org/10.1/x");
        expect(
            resultSourceLink({ sourceUrl: "https://doi.org/10.1/x", access: { canDisplayFullText: true } }),
        ).toBeNull();
        expect(resultSourceLink({ sourceUrl: "javascript:alert(1)" })).toBeNull();
    });

    it("shortens authors, dates, and source names", () => {
        expect(shortAuthors(["Elsayed, Ahmed", "Ayoub, Wadah", "A", "B"])).toBe(
            "Elsayed, Ahmed · Ayoub, Wadah · +2 more",
        );
        expect(shortAuthors(["Lincoff, A. Michael"])).toBe("Lincoff, A. Michael");
        expect(shortAuthors([])).toBeNull();
        expect(resultYear("2023-08-12")).toBe("2023");
        expect(resultYear("Aug 2019")).toBe("2019");
        expect(resultYear("")).toBeNull();
        expect(resultSourceName({ source: "europepmc" })).toBe("Europe PMC");
        expect(resultSourceName({ source: "nature", sourceLabel: "Nature Medicine" })).toBe(
            "Nature Medicine",
        );
    });

    it("counts results and the searches left in the right period", () => {
        expect(resultCountLabel(9876, 20)).toBe("9,876 results");
        expect(resultCountLabel(1_564_850, 19)).toBe("1.6M results");
        expect(resultCountLabel(0, 1)).toBe("1 result");
        expect(searchesLeftLabel(2, "guest")).toBe("2 searches left today");
        expect(searchesLeftLabel(1, "free")).toBe("1 search left this month");
        expect(searchesLeftLabel(null, "free")).toBeNull();
    });

    it("names the sources that didn't respond", () => {
        expect(sourcesDownNotice([], true)).toBeNull();
        expect(sourcesDownNotice(["NIH PubMed Central"], true)).toBe(
            "NIH PubMed Central didn’t respond, so these results come from the other sources. Try again in a minute.",
        );
        expect(sourcesDownNotice(["NIH PubMed Central", "Europe PMC"], false)).toBe(
            "NIH PubMed Central and Europe PMC didn’t respond. Try again in a minute.",
        );
        expect(sourcesDownNotice(["A", "B", "C"], false)).toBe("A, B, and C didn’t respond. Try again in a minute.");
    });
});
