import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cache = new Map<string, { citationCount: number; citationSource: string }>();

vi.mock("./provider-cache", () => ({
    getCachedValue: vi.fn(async (_namespace: string, key: string) => {
        return cache.get(key) ?? null;
    }),
    setCachedValue: vi.fn(
        async (
            _namespace: string,
            key: string,
            value: { citationCount: number; citationSource: string },
        ) => {
            cache.set(key, value);
        },
    ),
}));

import { attachPaperImpact } from "./paper-impact-lookup";

afterEach(() => {
    cache.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("paper impact lookup", () => {
    it("keeps native counts and fills missing Crossref / Europe PMC values", async () => {
        const fetch = vi.fn(async (url: string) => {
            const href = String(url);
            if (href.includes("api.crossref.org")) {
                return Response.json({
                    message: {
                        items: [{ DOI: "10.1234/example", "is-referenced-by-count": 41 }],
                    },
                });
            }
            return Response.json({
                resultList: {
                    result: [{ pmcid: "PMC999", citedByCount: 7 }],
                },
            });
        });
        vi.stubGlobal("fetch", fetch);

        const papers = await attachPaperImpact([
            {
                doi: "10.9999/scholar-native",
                citationCount: 88,
                citationSource: "scholar",
            },
            { doi: "https://doi.org/10.1234/Example" },
            { pmcid: "PMC999", idName: "pmcid", paperId: "999" },
        ]);

        expect(papers[0]).toMatchObject({
            citationCount: 88,
            citationSource: "scholar",
        });
        expect(papers[1]).toMatchObject({
            citationCount: 41,
            citationSource: "crossref",
        });
        expect(papers[2]).toMatchObject({
            citationCount: 7,
            citationSource: "europepmc",
        });
        expect(fetch).toHaveBeenCalled();
    });

    it("does not invent a count when indexes miss the paper", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ message: { items: [] }, resultList: { result: [] } })),
        );

        const [paper] = await attachPaperImpact([{ doi: "10.1234/missing" }]);
        expect(paper.citationCount).toBeUndefined();
    });
});
