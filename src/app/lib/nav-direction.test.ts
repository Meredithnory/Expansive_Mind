import { describe, expect, it } from "vitest";
import {
    directionForPush,
    directionFromTraverse,
    resolvePendingDirection,
} from "./nav-direction";

describe("directionFromTraverse", () => {
    it("moving to a lower history index is back", () => {
        expect(directionFromTraverse(3, 2)).toBe("back");
        expect(directionFromTraverse(3, 0)).toBe("back");
    });

    it("moving to a higher history index is forward", () => {
        expect(directionFromTraverse(1, 2)).toBe("forward");
    });

    it("same index (reload-like) has no direction", () => {
        expect(directionFromTraverse(2, 2)).toBe("none");
    });
});

describe("directionForPush", () => {
    it("hubs and the root fade in place", () => {
        expect(directionForPush("/")).toBe("none");
        expect(directionForPush("/discover")).toBe("none");
        expect(directionForPush("/projects")).toBe("none");
        expect(directionForPush("/searchpaper/")).toBe("none");
    });

    it("detail pages enter from the right", () => {
        expect(directionForPush("/projects/abc123")).toBe("forward");
        expect(directionForPush("/brief/glp-1-pricing")).toBe("forward");
        expect(directionForPush("/paperchatbot/pmc/PMC123")).toBe("forward");
    });
});

describe("resolvePendingDirection", () => {
    const now = 1_000_000;

    it("passes traversal directions through", () => {
        expect(resolvePendingDirection("back", now - 50, now, "/discover")).toBe("back");
        expect(resolvePendingDirection("forward", now - 50, now, "/")).toBe("forward");
    });

    it("resolves a push by route depth", () => {
        expect(resolvePendingDirection("push", now - 50, now, "/projects/x")).toBe("forward");
        expect(resolvePendingDirection("push", now - 50, now, "/projects")).toBe("none");
    });

    it("ignores a stale queued direction", () => {
        expect(resolvePendingDirection("back", now - 60_000, now, "/projects/x")).toBe("none");
    });
});
