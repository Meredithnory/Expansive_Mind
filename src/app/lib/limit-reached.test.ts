import { describe, expect, it } from "vitest";
import { normalizeLimitRequest } from "./limit-reached";

describe("normalizeLimitRequest", () => {
    it("keeps the allowance and a cleaned, capped note", () => {
        expect(normalizeLimitRequest({ feature: "search", note: "  Lab review\r\nfor PI\u0007 " })).toEqual({
            feature: "search",
            note: "Lab review\nfor PI",
        });
        expect(normalizeLimitRequest({ feature: "chat", note: "x".repeat(900) })?.note).toHaveLength(600);
        expect(normalizeLimitRequest({ feature: "discover" })).toEqual({ feature: "discover", note: "" });
    });

    it("refuses anything that isn't a monthly allowance", () => {
        expect(normalizeLimitRequest({ feature: "projects" })).toBeNull();
        expect(normalizeLimitRequest("discover")).toBeNull();
    });
});
