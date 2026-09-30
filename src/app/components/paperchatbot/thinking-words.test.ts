import { describe, expect, it } from "vitest";
import { THINKING_WORDS, nextThinkingWord } from "./thinking-words";

describe("nextThinkingWord", () => {
    it("starts on a word from the list", () => {
        expect(THINKING_WORDS).toContain(nextThinkingWord(null, () => 0));
        expect(THINKING_WORDS).toContain(nextThinkingWord(null, () => 0.999));
    });

    it("never repeats the word already showing", () => {
        for (const current of THINKING_WORDS) {
            for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
                expect(nextThinkingWord(current, () => roll)).not.toBe(current);
            }
        }
    });

    it("stays in range when the random source returns 1", () => {
        expect(THINKING_WORDS).toContain(nextThinkingWord("Titrating", () => 1));
    });

    it("has no duplicate words", () => {
        expect(new Set(THINKING_WORDS).size).toBe(THINKING_WORDS.length);
    });
});
