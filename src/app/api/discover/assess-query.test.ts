import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion, suggestSearchQueryNihOnly } = vi.hoisted(
    () => ({
        createPrivateChatCompletion: vi.fn(),
        suggestSearchQueryNihOnly: vi.fn(),
    }),
);

vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));
vi.mock("../search/spell-suggest", () => ({
    queriesMatch: (left: string, right: string) =>
        left.trim().toLowerCase().replace(/\s+/g, " ") ===
        right.trim().toLowerCase().replace(/\s+/g, " "),
    suggestSearchQueryNihOnly,
}));

import {
    assessDiscoveryQuestion,
    parseAssessmentContent,
} from "./assess-query";

describe("parseAssessmentContent", () => {
    it("reads corrected JSON and keeps the user's sentence shape", () => {
        expect(
            parseAssessmentContent(
                '{"status":"corrected","suggestion":"How to cure post inflammatory hyperpigmentation on skin?"}',
                "How to cure post inflammry hyperpigmentation on skin?",
            ),
        ).toEqual({
            status: "corrected",
            suggestion:
                "How to cure post inflammatory hyperpigmentation on skin?",
        });
    });

    it("treats unclear and ok statuses", () => {
        expect(parseAssessmentContent('{"status":"unclear"}', "efrerg")).toEqual(
            {
                status: "unclear",
                suggestion: null,
            },
        );
        expect(parseAssessmentContent("OK", "CRISPR Cas9")).toEqual({
            status: "ok",
            suggestion: null,
        });
    });
});

describe("assessDiscoveryQuestion", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
        suggestSearchQueryNihOnly.mockReset();
        suggestSearchQueryNihOnly.mockResolvedValue(null);
        process.env.AI_API_KEY = "test-key";
    });

    it("returns unclear for keyboard smash without calling the model", async () => {
        await expect(assessDiscoveryQuestion("asdfgh")).resolves.toEqual({
            status: "unclear",
            suggestion: null,
        });
        expect(createPrivateChatCompletion).not.toHaveBeenCalled();
    });

    it("returns a model spelling correction", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            status: "corrected",
                            suggestion:
                                "How to cure post inflammatory hyperpigmentation on skin?",
                        }),
                    },
                },
            ],
        });

        await expect(
            assessDiscoveryQuestion(
                "How to cure post inflammry hyperpigmentation on skin?",
            ),
        ).resolves.toEqual({
            status: "corrected",
            suggestion:
                "How to cure post inflammatory hyperpigmentation on skin?",
        });
    });

    it("returns unclear when the model cannot read the query", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({ status: "unclear" }),
                    },
                },
            ],
        });

        await expect(assessDiscoveryQuestion("efrerg")).resolves.toEqual({
            status: "unclear",
            suggestion: null,
        });
    });
});
