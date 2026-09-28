import { describe, expect, it } from "vitest";
import {
    DEFAULT_PAPER_PROMPTS,
    buildChatMessages,
    paperChatPrompts,
    splitFollowUps,
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

describe("splitFollowUps", () => {
    it("leaves a reply without a next block alone", () => {
        expect(splitFollowUps("About 30–40%.")).toEqual({
            text: "About 30–40%.",
            followUps: [],
        });
    });

    it("pulls a closed next block out of the reply", () => {
        const reply = [
            ":::cite|Introduction|1|1",
            "only approximately 30–40% of the MACE reduction",
            ":::",
            "About 30–40%.",
            "",
            ":::next",
            "What did FLOW show for kidney outcomes?",
            "Which mechanisms might explain the rest?",
            ":::",
        ].join("\n");
        const { text, followUps } = splitFollowUps(reply);
        expect(followUps).toEqual([
            "What did FLOW show for kidney outcomes?",
            "Which mechanisms might explain the rest?",
        ]);
        expect(text).toContain(":::cite|Introduction|1|1");
        expect(text).toContain("About 30–40%.");
        expect(text).not.toContain(":::next");
        expect(text).not.toContain("FLOW");
    });

    it("reads an unclosed block at the end", () => {
        const { text, followUps } = splitFollowUps(
            "Answer.\n:::next\nHow strong is this evidence?",
        );
        expect(text).toBe("Answer.");
        expect(followUps).toEqual(["How strong is this evidence?"]);
    });

    it("strips list markers, quotes, and repeats, and keeps three", () => {
        const { followUps } = splitFollowUps(
            [
                "Answer.",
                ":::next",
                "1. First?",
                "- \"Second?\"",
                "",
                "* first?",
                "• Third?",
                "Fourth?",
                ":::",
            ].join("\n"),
        );
        expect(followUps).toEqual(["First?", "Second?", "Third?"]);
    });
});
