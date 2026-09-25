import { describe, expect, it } from "vitest";
import {
    SYNTHETIC_MOUSE_WINDOW_MS,
    TOUCH_HIGHLIGHT_SETTLE_MS,
    highlightCommitDelay,
    isSyntheticMouseAfterTouch,
} from "./highlight-gesture";

describe("highlight gesture timing", () => {
    it("commits a mouse selection immediately", () => {
        expect(highlightCommitDelay("mouse")).toBe(0);
    });

    it("waits for an iOS touch selection to finish moving", () => {
        expect(highlightCommitDelay("touch")).toBe(TOUCH_HIGHLIGHT_SETTLE_MS);
        expect(TOUCH_HIGHLIGHT_SETTLE_MS).toBeGreaterThan(300);
    });

    it("ignores the mouseup that iOS synthesizes after a touch", () => {
        const touchEndedAt = 1_000;
        expect(isSyntheticMouseAfterTouch(touchEndedAt, touchEndedAt + 20)).toBe(
            true,
        );
        expect(
            isSyntheticMouseAfterTouch(
                touchEndedAt,
                touchEndedAt + SYNTHETIC_MOUSE_WINDOW_MS,
            ),
        ).toBe(false);
        expect(isSyntheticMouseAfterTouch(null, touchEndedAt)).toBe(false);
    });
});
