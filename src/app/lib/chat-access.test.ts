import { describe, expect, it } from "vitest";
import { paperChatMode } from "./chat-access";

describe("paperChatMode", () => {
    it("uses excerpts from the body for a licensed paper", () => {
        expect(paperChatMode({ access: { canSendToAI: true } })).toBe("full");
    });

    it("uses the abstract for an unlicensed paper that has one", () => {
        expect(
            paperChatMode({
                abstract: "We enrolled 42 adults.",
                access: { canSendToAI: false },
            }),
        ).toBe("abstract");
    });

    it("turns chat off without an abstract", () => {
        expect(
            paperChatMode({ abstract: "  ", access: { canSendToAI: false } }),
        ).toBeNull();
    });

    it("never chats over a Scholar snippet, even when access says yes", () => {
        expect(
            paperChatMode({
                source: "scholar",
                abstract: "Snippet",
                access: { canSendToAI: true },
            }),
        ).toBeNull();
        expect(
            paperChatMode({
                contentLabel: "Search snippet",
                abstract: "Snippet",
                access: { canSendToAI: false },
            }),
        ).toBeNull();
    });
});
