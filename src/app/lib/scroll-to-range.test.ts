import { describe, expect, it } from "vitest";
import { passageScrollDelta } from "./scroll-to-range";

describe("passageScrollDelta", () => {
    it("puts the passage's first line a quarter of the way down the pane", () => {
        // Pane from y=100, 800px tall; passage starts at y=1300 → land at 100 + 200.
        expect(passageScrollDelta(1300, 100, 800)).toBe(1000);
    });

    it("scrolls up when the passage is above the reading line", () => {
        expect(passageScrollDelta(50, 100, 800)).toBe(-250);
    });
});
