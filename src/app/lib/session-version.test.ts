import { describe, expect, it } from "vitest";
import {
    sessionVersion,
    sessionVersionMatches,
} from "./session-version";

describe("session versions", () => {
    it("accepts matching versions and rejects older tokens", () => {
        expect(sessionVersionMatches(2, 2)).toBe(true);
        expect(sessionVersionMatches(1, 2)).toBe(false);
    });

    it("treats pre-version tokens as version zero", () => {
        expect(sessionVersion(undefined)).toBe(0);
        expect(sessionVersionMatches(undefined, 0)).toBe(true);
        expect(sessionVersionMatches(undefined, 1)).toBe(false);
    });
});
