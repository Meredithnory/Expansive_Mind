import { describe, expect, it } from "vitest";
import {
    calculateCropRect,
    isFigureCaptureMethod,
} from "./figure-capture";

describe("figure capture policy", () => {
    it.each(["upload", "paste", "screen_capture", "page_region"])(
        "accepts the supported %s method",
        (method) => {
            expect(isFigureCaptureMethod(method)).toBe(true);
        },
    );

    it("rejects remote retrieval as a capture method", () => {
        expect(isFigureCaptureMethod("remote_url")).toBe(false);
    });

    it("calculates and clamps crop geometry", () => {
        expect(
            calculateCropRect(1000, 500, {
                top: 10,
                right: 20,
                bottom: 10,
                left: 20,
            }),
        ).toEqual({ x: 200, y: 50, width: 600, height: 400 });
        expect(
            calculateCropRect(100, 100, {
                top: -5,
                right: 90,
                bottom: 0,
                left: 0,
            }),
        ).toEqual({ x: 0, y: 0, width: 60, height: 100 });
    });
});
