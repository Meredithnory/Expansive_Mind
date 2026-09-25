import { describe, expect, it } from "vitest";
import {
    focusedFieldScrollDelta,
    keyboardInsetFromViewport,
    resolveKeyboardChrome,
} from "./keyboard-inset";

describe("keyboardInsetFromViewport", () => {
    it("is 0 when the visual viewport fills the layout", () => {
        expect(keyboardInsetFromViewport(844, 844, 0)).toBe(0);
    });

    it("returns the covered height when the keyboard overlays the bottom", () => {
        expect(keyboardInsetFromViewport(844, 544, 0)).toBe(300);
    });

    it("does not count a visual-viewport pan as extra inset", () => {
        expect(keyboardInsetFromViewport(844, 544, 80)).toBe(220);
    });
});

describe("resolveKeyboardChrome", () => {
    it("keeps the pre-keyboard height while the keyboard is open", () => {
        const chrome = resolveKeyboardChrome(844, 544, 0, 844);
        expect(chrome).toMatchObject({
            inset: 300,
            offsetTop: 0,
            open: true,
            stableHeight: 844,
        });
    });

    it("does not treat a URL-bar resize as a keyboard", () => {
        const chrome = resolveKeyboardChrome(820, 800, 0, 844);
        expect(chrome.open).toBe(false);
        expect(chrome.stableHeight).toBe(820);
    });

    it("uses the virtual keyboard height when the layout viewport does not shrink", () => {
        const chrome = resolveKeyboardChrome(844, 844, 0, 844, 320);
        expect(chrome.inset).toBe(320);
        expect(chrome.open).toBe(true);
        expect(chrome.stableHeight).toBe(844);
    });

    it("does not add the virtual keyboard on top of the viewport inset", () => {
        const chrome = resolveKeyboardChrome(844, 544, 0, 844, 300);
        expect(chrome.inset).toBe(300);
    });

    it("reports the pan separately from the bottom inset", () => {
        const chrome = resolveKeyboardChrome(844, 544, 80, 844);
        expect(chrome.inset).toBe(220);
        expect(chrome.offsetTop).toBe(80);
        expect(chrome.stableHeight).toBe(844);
    });
});

describe("focusedFieldScrollDelta", () => {
    it("does not scroll a field that already sits in the band", () => {
        expect(focusedFieldScrollDelta(120, 168, 8, 456)).toBe(0);
    });

    it("scrolls just enough to clear the bar below the field", () => {
        expect(focusedFieldScrollDelta(400, 480, 8, 456)).toBe(24);
    });

    it("scrolls a field back down when it sits above the band", () => {
        expect(focusedFieldScrollDelta(-40, 20, 8, 456)).toBe(-48);
    });
});
