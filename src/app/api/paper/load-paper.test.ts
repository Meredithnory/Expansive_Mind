import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    cached: vi.fn(),
    fetchPaperBySource: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/provider-cache", () => ({ cached: mocks.cached }));
vi.mock("./sources", () => ({
    fetchPaperBySource: mocks.fetchPaperBySource,
}));

import {
    loadCachedPaperBySource,
    paperDetailCacheKey,
} from "./load-paper";

describe("cached paper loading", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cached.mockImplementation(async (input) => ({
            value: await input.load(),
            cacheHit: false,
        }));
    });

    it("reuses the established paper cache namespace, key, and TTL", async () => {
        const fallback = {
            title: "Fallback title",
            authors: ["Researcher"],
            abstract: "Fallback abstract",
        };
        const paper = { title: "Loaded paper" };
        mocks.fetchPaperBySource.mockResolvedValue(paper);

        await expect(
            loadCachedPaperBySource(
                "springer",
                "10.1000/example",
                "doi",
                fallback,
            ),
        ).resolves.toEqual({ value: paper, cacheHit: false });

        expect(mocks.cached).toHaveBeenCalledWith(
            expect.objectContaining({
                namespace: "paper-detail-v3",
                key: "springer:10.1000/example:doi",
                ttlSeconds: 6 * 60 * 60,
                load: expect.any(Function),
            }),
        );
        expect(mocks.fetchPaperBySource).toHaveBeenCalledWith(
            "springer",
            "10.1000/example",
            "doi",
            fallback,
        );
    });

    it("keeps an omitted id name compatible with the existing key shape", () => {
        expect(paperDetailCacheKey("nih", "PMC123")).toBe("nih:PMC123:");
    });
});
