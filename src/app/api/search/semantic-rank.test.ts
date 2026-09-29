import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateEmbedding } = vi.hoisted(() => ({
    createPrivateEmbedding: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateEmbedding }));

import { rankSearchResults, SEMANTIC_POOL_SIZE } from "./semantic-rank";

type Row = {
    sourceId: string;
    title: string;
    abstract?: string;
    source: "nih" | "nature";
    access?: { canSendToAI?: boolean };
};

// Springer hits arrive first, NIH hits after, the way Discover merges them.
const springer = (count: number): Row[] =>
    Array.from({ length: count }, (_, index) => ({
        sourceId: `s${index}`,
        title: `Imaging protocols in cardiology volume ${index}`,
        abstract: "A review of imaging methods for heart failure clinics.",
        source: "nature",
        access: { canSendToAI: true },
    }));

const nihMatch: Row = {
    sourceId: "n1",
    title: "CAR-T cell persistence in solid tumors",
    source: "nih",
    access: { canSendToAI: true },
};

describe("rankSearchResults", () => {
    const key = process.env.AI_API_KEY;

    beforeEach(() => {
        createPrivateEmbedding.mockReset();
        delete process.env.AI_API_KEY;
    });

    afterEach(() => {
        if (key === undefined) delete process.env.AI_API_KEY;
        else process.env.AI_API_KEY = key;
    });

    it("lets a relevant NIH paper with no abstract outrank a list of Springer papers", async () => {
        const ranked = await rankSearchResults("CAR-T cell persistence in solid tumors", [
            ...springer(46),
            nihMatch,
        ]);
        expect(ranked[0].sourceId).toBe("n1");
    });

    it("no longer moves the best Springer paper to the top by default", async () => {
        const ranked = await rankSearchResults("CAR-T cell persistence in solid tumors", [
            nihMatch,
            ...springer(3),
        ]);
        expect(ranked[0].sourceId).toBe("n1");
    });

    it("gives the embedding check the best matches, wherever they sit in the list", async () => {
        process.env.AI_API_KEY = "test";
        createPrivateEmbedding.mockImplementation(async ({ input }: { input: string[] }) => ({
            data: input.map((text) => ({
                embedding: text.includes("CAR-T") ? [1, 0] : [0, 1],
            })),
        }));

        const ranked = await rankSearchResults("CAR-T cell persistence in solid tumors", [
            ...springer(60),
            nihMatch,
        ]);

        const inputs: string[] = createPrivateEmbedding.mock.calls[0][0].input;
        // The query plus the pool; the late NIH match is in it.
        expect(inputs).toHaveLength(SEMANTIC_POOL_SIZE + 1);
        expect(inputs.some((text) => text.startsWith("CAR-T cell persistence"))).toBe(true);
        expect(ranked[0].sourceId).toBe("n1");
    });
});
