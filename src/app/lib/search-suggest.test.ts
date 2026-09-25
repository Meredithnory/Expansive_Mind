import { afterEach, describe, expect, it, vi } from "vitest";
import {
    fetchSearchSuggestion,
    getGhostCompletionSuffix,
    normalizeSearchQuery,
    searchQueriesMatch,
} from "./search-suggest";

describe("search suggestion helpers", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("normalizes case and whitespace before comparing queries", () => {
        expect(normalizeSearchQuery("  Protein   Kinase ")).toBe(
            "protein kinase",
        );
        expect(searchQueriesMatch("Protein Kinase", " protein  kinase ")).toBe(
            true,
        );
        expect(searchQueriesMatch("kinase", "kinases")).toBe(false);
    });

    it("returns only the unmatched tail of a completion", () => {
        expect(getGhostCompletionSuffix("Mito", "mitochondria")).toBe(
            "chondria",
        );
        expect(getGhostCompletionSuffix("kinase", "kinase")).toBe("");
        expect(getGhostCompletionSuffix("kinase", "protein")).toBe("");
        expect(getGhostCompletionSuffix("", "kinase")).toBe("");
    });

    it("loads a suggestion and omits the source filter when it is all", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                originalQuery: "protien",
                suggestedQuery: "protein",
                suggestedTotalCount: 4,
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchSearchSuggestion(" protien ")).resolves.toEqual({
            originalQuery: "protien",
            suggestedQuery: "protein",
            suggestedTotalCount: 4,
        });
        expect(String(fetchMock.mock.calls[0][0])).toBe(
            "/api/search/suggest?q=protien",
        );

        await expect(fetchSearchSuggestion("protien", "nih")).resolves.toEqual({
            originalQuery: "protien",
            suggestedQuery: "protein",
            suggestedTotalCount: 4,
        });
        expect(String(fetchMock.mock.calls[1][0])).toContain("source=nih");
    });

    it("returns null for an empty query or a failed response", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false });
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchSearchSuggestion("   ")).resolves.toBeNull();
        await expect(fetchSearchSuggestion("protien")).resolves.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
