import { describe, expect, it } from "vitest";
import {
    matchesLibraryQuery,
    nextProjectStep,
    normalizeLibraryQuery,
    paperAccessLabel,
    paperOpenLabel,
    parseLibraryTab,
    plansPerSynthesis,
    projectProgress,
    synthesisGapTitles,
} from "./library-view";

const step = (title: string, status: "pending" | "in-progress" | "done") => ({
    title,
    description: "",
    status,
    paperRefs: [],
});

describe("parseLibraryTab", () => {
    it("opens on syntheses unless a known tab is asked for", () => {
        expect(parseLibraryTab(undefined)).toBe("syntheses");
        expect(parseLibraryTab("nope")).toBe("syntheses");
        expect(parseLibraryTab("papers")).toBe("papers");
        expect(parseLibraryTab(["highlights", "papers"])).toBe("highlights");
        expect(parseLibraryTab("projects")).toBe("projects");
    });
});

describe("library search", () => {
    it("matches any field, ignoring case and extra spaces", () => {
        const query = normalizeLibraryQuery("  GLP-1   Receptor ");
        expect(query).toBe("glp-1 receptor");
        expect(matchesLibraryQuery(query, "Does glp-1 receptor agonism help?")).toBe(true);
        expect(matchesLibraryQuery(query, undefined, "CAR-T persistence")).toBe(false);
        expect(matchesLibraryQuery("", undefined)).toBe(true);
    });
});

describe("synthesisGapTitles", () => {
    it("reads gap titles from a saved report and skips blanks", () => {
        const report = {
            sections: {
                gaps: [
                    { title: " Gap one " },
                    { title: "" },
                    { description: "no title" },
                    { title: "Gap two" },
                    { title: "Gap three" },
                ],
            },
        };
        expect(synthesisGapTitles(report)).toEqual(["Gap one", "Gap two", "Gap three"]);
        expect(synthesisGapTitles(report, 2)).toEqual(["Gap one", "Gap two"]);
    });

    it("returns nothing for missing or malformed reports", () => {
        expect(synthesisGapTitles(undefined)).toEqual([]);
        expect(synthesisGapTitles({ sections: { gaps: "x" } })).toEqual([]);
    });
});

describe("research plan progress", () => {
    it("counts done steps and finds the next open one", () => {
        const project = {
            plan: [step("Read", "done"), step("Compare", "in-progress"), step("Write", "pending")],
        };
        expect(projectProgress(project)).toEqual({ done: 1, total: 3 });
        expect(nextProjectStep(project)).toBe("Compare");
        expect(nextProjectStep({ plan: [step("Read", "done")] })).toBeNull();
    });

    it("counts plans per source synthesis", () => {
        const counts = plansPerSynthesis([
            { sourceDiscoveryID: "a" },
            { sourceDiscoveryID: "a" },
            { sourceDiscoveryID: null },
            { sourceDiscoveryID: "b" },
        ]);
        expect(counts.get("a")).toBe(2);
        expect(counts.get("b")).toBe(1);
        expect(counts.size).toBe(2);
    });
});

describe("saved paper access", () => {
    it("labels only what the library already knows", () => {
        expect(paperAccessLabel({ accessStatus: "available", canSendToAI: true })).toBe("Full text");
        expect(paperAccessLabel({ accessStatus: "check", canSendToAI: null })).toBeNull();
        expect(paperAccessLabel({ accessStatus: "restricted", canSendToAI: false })).toBeNull();
        expect(
            paperAccessLabel({ accessStatus: "available", canSendToAI: true, contentLabel: "Search snippet" }),
        ).toBe("Search snippet");
    });

    it("names the open action by what the reader can do", () => {
        expect(paperOpenLabel({ accessStatus: "available", canSendToAI: true })).toBe("Open paper chat");
        expect(paperOpenLabel({ accessStatus: "check", canSendToAI: null })).toBe("Open paper");
        expect(paperOpenLabel({ accessStatus: "restricted", canSendToAI: false })).toBe("View source");
    });
});
