import { describe, expect, it } from "vitest";
import { abstractToText } from "./abstract-text";

describe("abstractToText", () => {
    it("flattens springer structured abstracts with h1/p keys", () => {
        expect(abstractToText({ h1: "Background", p: "AI is useful." })).toBe(
            "AI is useful.",
        );
        expect(
            abstractToText({ h1: "Background", p: ["One.", "Two."] }),
        ).toBe("One. Two.");
    });

    it("handles plain strings and arrays", () => {
        expect(abstractToText("Plain abstract")).toBe("Plain abstract");
        expect(abstractToText(["Para one.", "Para two."])).toBe(
            "Para one. Para two.",
        );
    });
});
