import { describe, expect, it } from "vitest";
import { railGestureAxis } from "./horizontal-rail";

describe("railGestureAxis", () => {
    it("waits until the finger has actually moved", () => {
        expect(railGestureAxis(2, -3)).toBeNull();
    });

    it("lets a vertical swipe scroll the page", () => {
        expect(railGestureAxis(4, -40)).toBe("y");
    });

    it("keeps a horizontal swipe on the rail", () => {
        expect(railGestureAxis(-48, 6)).toBe("x");
    });
});
