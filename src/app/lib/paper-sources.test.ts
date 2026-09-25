import { describe, expect, it } from "vitest";
import {
    buildPaperFocusHref,
    locatorFromLoadedPaper,
    makePaperLocator,
    normalizeStoredPaperId,
    searchSourceTag,
} from "./paper-sources";

describe("normalizeStoredPaperId", () => {
    it("strips PMC prefix and non-digits for PMC identifiers", () => {
        expect(normalizeStoredPaperId("PMC1234567")).toBe("1234567");
        expect(normalizeStoredPaperId("pmc1234567")).toBe("1234567");
        expect(normalizeStoredPaperId("PMC 1234567")).toBe("1234567");
    });

    it("preserves DOIs used by Springer", () => {
        expect(normalizeStoredPaperId("10.1186/s41073-026-00245-8")).toBe(
            "10.1186/s41073-026-00245-8",
        );
        expect(normalizeStoredPaperId(" 10.1007/s43681-026-01254-5 ")).toBe(
            "10.1007/s43681-026-01254-5",
        );
    });

    it("preserves Scholar cluster IDs and bare numeric PMC IDs", () => {
        expect(normalizeStoredPaperId("7955732030691120796")).toBe(
            "7955732030691120796",
        );
        expect(normalizeStoredPaperId("1234567")).toBe("1234567");
    });
});

describe("buildPaperFocusHref", () => {
    it("adds a method focus query to a paper path", () => {
        const href = buildPaperFocusHref(
            "/paperchatbot/nih/1234567",
            "Mice were transfected with 2 ug plasmid.",
        );
        const params = new URLSearchParams(href.split("?")[1]);
        expect(href.startsWith("/paperchatbot/nih/1234567?")).toBe(true);
        expect(params.get("intent")).toBe("method");
        expect(params.get("focus")).toBe(
            "Mice were transfected with 2 ug plasmid.",
        );
    });

    it("keeps existing query params and ignores external URLs", () => {
        expect(
            buildPaperFocusHref(
                "/paperchatbot/springer/10.1186%2Fs12917-015-0540-4?idName=doi",
            ),
        ).toBe(
            "/paperchatbot/springer/10.1186%2Fs12917-015-0540-4?idName=doi&intent=method",
        );
        expect(buildPaperFocusHref("https://doi.org/10.1/example")).toBe(
            "https://doi.org/10.1/example",
        );
    });
});

describe("searchSourceTag / locatorFromLoadedPaper", () => {
    it("maps springer to the persisted nature search tag", () => {
        expect(searchSourceTag("nih")).toBe("nih");
        expect(searchSourceTag("scholar")).toBe("scholar");
        expect(searchSourceTag("springer")).toBe("nature");
    });

    it("homes a Scholar load that resolved to PMC on nih", () => {
        const requested = makePaperLocator(
            "scholar",
            "7955732030691120796",
            "cluster_id",
        );
        expect(
            locatorFromLoadedPaper(
                { source: "nih", paperId: "1234567", idName: "pmcid" },
                requested,
            ),
        ).toEqual({
            database: "nih",
            paperId: "1234567",
            idName: "pmcid",
        });
    });
});
