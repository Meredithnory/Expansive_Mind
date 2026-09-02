import { describe, expect, it } from "vitest";
import {
    DEFAULT_PAPER_PROMPTS,
    buildChatMessages,
    paperChatPrompts,
} from "./chat-messages";

describe("paper chat prompts", () => {
    it("returns the default research prompts", () => {
        expect(paperChatPrompts()).toEqual([...DEFAULT_PAPER_PROMPTS]);
    });

    it("adds a figure prompt when a source image can be analyzed", () => {
        expect(
            paperChatPrompts({
                figures: [
                    {
                        id: "Fig1",
                        label: "Fig. 1",
                        caption: "",
                        sectionTitle: "Results",
                        hasSeparateRights: false,
                        canAnalyzeSourceImage: true,
                    },
                ],
            }),
        ).toContain("Walk me through the key figure.");
    });

    it("drops leftover welcome bubbles from saved conversations", () => {
        expect(
            buildChatMessages([
                {
                    id: "welcome",
                    sender: "ai",
                    message: "old welcome",
                    timestamp: new Date(),
                },
                {
                    id: "user-1",
                    sender: "user",
                    message: "What was measured?",
                    timestamp: new Date(),
                },
            ]),
        ).toEqual([
            expect.objectContaining({
                id: "user-1",
                message: "What was measured?",
            }),
        ]);
    });
});
