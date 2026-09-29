import { describe, expect, it } from "vitest";
import {
    buildPaperFocusHref,
    parseReportPaperNumber,
    withReportOrigin,
    reportReturnHref,
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

describe("withReportOrigin", () => {
    it("carries the saved report and tab so the reader can link back", () => {
        const id = "64b0000000000000000000a1";
        const href = withReportOrigin("/paperchatbot/nih/1234567", 3, 2, {
            report: id,
            view: "gaps",
        });
        const params = new URLSearchParams(href.split("?")[1]);
        expect(params.get("report")).toBe(id);
        expect(params.get("view")).toBe("gaps");
        expect(params.get("gap")).toBe("2");
        // A guest report has no saved id; an unknown tab is dropped.
        const guest = withReportOrigin("/paperchatbot/nih/1234567", 3, null, {
            report: "guest-123",
            view: "elsewhere",
        });
        expect(guest).toBe("/paperchatbot/nih/1234567?from=report&paper=3");
    });

    it("marks a reader link as opened from a report", () => {
        const href = withReportOrigin(
            buildPaperFocusHref("/paperchatbot/nih/1234567", "A passage."),
            3,
        );
        const params = new URLSearchParams(href.split("?")[1]);
        expect(href.startsWith("/paperchatbot/nih/1234567?")).toBe(true);
        expect(params.get("from")).toBe("report");
        expect(params.get("paper")).toBe("3");
        expect(params.get("focus")).toBe("A passage.");
    });

    it("skips a missing paper number and external URLs", () => {
        expect(withReportOrigin("/paperchatbot/nih/1234567")).toBe(
            "/paperchatbot/nih/1234567?from=report",
        );
        expect(withReportOrigin("https://doi.org/10.1/example", 2)).toBe(
            "https://doi.org/10.1/example",
        );
    });

    it("reads only a small positive paper number back", () => {
        expect(parseReportPaperNumber("3")).toBe(3);
        expect(parseReportPaperNumber("0")).toBeNull();
        expect(parseReportPaperNumber("3x")).toBeNull();
        expect(parseReportPaperNumber("12345")).toBeNull();
        expect(parseReportPaperNumber(null)).toBeNull();
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

describe("buildPaperFocusHref without method intent", () => {
    it("adds only the focus passage", () => {
        const href = buildPaperFocusHref(
            "/paperchatbot/springer/10.1186/abc",
            "  A saved   highlight ",
            { method: false },
        );
        expect(href).toBe("/paperchatbot/springer/10.1186/abc?focus=A+saved+highlight");
    });
});

describe("reportReturnHref", () => {
    const id = "64b0000000000000000000a1";

    it("reopens the saved report on the tab and gap the paper came from", () => {
        expect(reportReturnHref({ report: id, view: "gaps", gap: 2, paper: 3 })).toBe(
            `/discover?saved=${id}&view=gaps&gap=2`,
        );
        expect(reportReturnHref({ report: id, view: "papers", gap: 2, paper: 3 })).toBe(
            `/discover?saved=${id}&view=papers&paper=3`,
        );
    });

    it("falls back to the guest report in this browser", () => {
        expect(reportReturnHref({ view: "state" })).toBe("/discover?view=state");
        expect(reportReturnHref({})).toBe("/discover");
    });
});
