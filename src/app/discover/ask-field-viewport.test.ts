import { describe, expect, it } from "vitest";
import { discoverAskKeyboardInset } from "./ask-field-viewport";

describe("discoverAskKeyboardInset", () => {
    it("is 0 when the visual viewport fills the layout", () => {
        expect(discoverAskKeyboardInset(844, 844, 0)).toBe(0);
    });

    it("returns the covered height when the keyboard overlays the bottom", () => {
        expect(discoverAskKeyboardInset(844, 544, 0)).toBe(300);
    });

    it("does not count a visual-viewport pan as extra inset", () => {
        expect(discoverAskKeyboardInset(844, 544, 80)).toBe(220);
    });

    it("never returns a negative inset", () => {
        expect(discoverAskKeyboardInset(844, 900, 0)).toBe(0);
        expect(discoverAskKeyboardInset(844, 844, -40)).toBe(0);
    });
});
