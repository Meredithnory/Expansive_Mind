import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion } = vi.hoisted(() => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));

import { expandDiscoveryQueries } from "./expand-queries";

describe("expandDiscoveryQueries", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
    });

    it("returns the original question plus parsed sub-queries", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            queries: [
                                "GLP-1 receptor mechanism aging",
                                "GLP-1 cardiovascular clinical trials",
                                "incretin methods assay technology",
                            ],
                        }),
                    },
                },
            ],
        });

        const question = "How does GLP-1 affect aging?";
        const queries = await expandDiscoveryQueries(question, {
            feature: "discover",
            userID: "user-1",
        });

        expect(queries[0]).toBe(question);
        expect(queries).toEqual([
            question,
            "GLP-1 receptor mechanism aging",
            "GLP-1 cardiovascular clinical trials",
            "incretin methods assay technology",
        ]);
        const [request, usageContext] =
            createPrivateChatCompletion.mock.calls[0];
        expect(request.model).toBe("openai/gpt-4.1-mini");
        expect(request.max_tokens).toBe(300);
        expect(request.temperature).toBe(0.2);
        expect(request.messages[0].content).toContain(
            "untrusted quoted material",
        );
        expect(usageContext).toEqual({
            feature: "discover",
            userID: "user-1",
        });
    });

    it("strips code fences, skips duplicates, and caps at four sub-queries", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: `\`\`\`json
{"queries":["How does GLP-1 affect aging?","alpha","beta","gamma","delta","epsilon"]}
\`\`\``,
                    },
                },
            ],
        });

        const question = "How does GLP-1 affect aging?";
        const queries = await expandDiscoveryQueries(question);

        expect(queries).toEqual([
            question,
            "alpha",
            "beta",
            "gamma",
            "delta",
        ]);
    });

    it("falls back to the original question when the model fails", async () => {
        createPrivateChatCompletion.mockRejectedValue(new Error("timeout"));
        const question = "What causes preeclampsia?";
        await expect(expandDiscoveryQueries(question)).resolves.toEqual([
            question,
        ]);
    });

    it("falls back to the original question when JSON is invalid", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [{ message: { content: "not json at all" } }],
        });
        const question = "CRISPR delivery to the retina";
        await expect(expandDiscoveryQueries(question)).resolves.toEqual([
            question,
        ]);
    });

    it("drops generated provider queries over the size limit", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            queries: ["x".repeat(301), "short query"],
                        }),
                    },
                },
            ],
        });

        await expect(expandDiscoveryQueries("original")).resolves.toEqual([
            "original",
            "short query",
        ]);
    });
});
