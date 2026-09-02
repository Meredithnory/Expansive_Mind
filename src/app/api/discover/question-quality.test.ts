import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion } = vi.hoisted(() => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));

import {
    judgeResearchQuestion,
    parseQuestionQuality,
    QUESTION_QUALITY_MODEL,
    shouldSearchLiterature,
} from "./question-quality";

describe("shouldSearchLiterature", () => {
    it("skips search only when the question is clearly not research", () => {
        expect(shouldSearchLiterature("not_research")).toBe(false);
        expect(shouldSearchLiterature("research")).toBe(true);
        expect(shouldSearchLiterature("unknown")).toBe(true);
    });
});

describe("parseQuestionQuality", () => {
    it("reads a boolean researchQuestion flag", () => {
        expect(parseQuestionQuality({ researchQuestion: true })).toBe(
            "research",
        );
        expect(parseQuestionQuality({ researchQuestion: false })).toBe(
            "not_research",
        );
    });

    it("treats unreadable output as unknown so we keep current behavior", () => {
        expect(parseQuestionQuality(null)).toBe("unknown");
        expect(parseQuestionQuality({ nope: 1 })).toBe("unknown");
        expect(parseQuestionQuality("maybe later")).toBe("unknown");
    });
});

describe("judgeResearchQuestion", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
    });

    it("calls the cheap nano model and does not ask it to analyze papers", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({ researchQuestion: false }),
                    },
                },
            ],
        });

        await expect(
            judgeResearchQuestion("weijptw", {
                feature: "discover",
                userID: "user-1",
            }),
        ).resolves.toBe("not_research");

        const [request, usageContext] =
            createPrivateChatCompletion.mock.calls[0];
        expect(request.model).toBe(QUESTION_QUALITY_MODEL);
        expect(request.model).toBe("openai/gpt-4.1-nano");
        expect(request.max_tokens).toBe(40);
        expect(request.messages[0].content).toContain(
            "untrusted quoted material",
        );
        expect(request.messages[0].content).toContain("keyboard smash");
        expect(request.messages[0].content).not.toContain("opportunity report");
        expect(usageContext).toEqual({
            feature: "discover",
            userID: "user-1",
        });
    });

    it("fails open when the model call blows up", async () => {
        createPrivateChatCompletion.mockRejectedValue(new Error("timeout"));
        await expect(
            judgeResearchQuestion("How does GLP-1 affect aging?"),
        ).resolves.toBe("unknown");
    });
});
