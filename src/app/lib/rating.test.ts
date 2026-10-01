import { describe, expect, it } from "vitest";
import {
    RATING_COOLDOWN_MS,
    normalizeRating,
    normalizeRatingComment,
    ratingShares,
    shouldAskForRating,
} from "./rating";

describe("shouldAskForRating", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");

    it("asks a browser that was never asked", () => {
        expect(shouldAskForRating(null, now)).toBe(true);
        expect(shouldAskForRating(Number.NaN, now)).toBe(true);
    });

    it("waits out the cooldown after asking", () => {
        expect(shouldAskForRating(now - 60_000, now)).toBe(false);
        expect(shouldAskForRating(now - RATING_COOLDOWN_MS, now)).toBe(true);
    });
});

describe("normalizeRating", () => {
    it("keeps a known score, surface, and trimmed context", () => {
        expect(normalizeRating({ score: "good", surface: "discover", context: "  CAR-T\tin lupus " })).toEqual({
            score: "good",
            surface: "discover",
            context: "CAR-T in lupus",
        });
    });

    it("carries a comment when the score is sent again with one", () => {
        expect(normalizeRating({ score: "bad", surface: "paper_chat", comment: "Too slow" })).toMatchObject({
            comment: "Too slow",
        });
    });

    it("rejects anything else", () => {
        expect(normalizeRating({ score: "great", surface: "discover" })).toBeNull();
        expect(normalizeRating({ score: "good", surface: "admin" })).toBeNull();
        expect(normalizeRating("good")).toBeNull();
    });
});

describe("normalizeRatingComment", () => {
    const id = "0123456789abcdef01234567";

    it("keeps line breaks but not control characters, capped at 1,000", () => {
        expect(normalizeRatingComment({ id, comment: "Line one\r\n\n\n\nLine two\u0007" })).toEqual({
            id,
            comment: "Line one\n\nLine two",
        });
        expect(normalizeRatingComment({ id, comment: "x".repeat(2_000) })?.comment).toHaveLength(1_000);
    });

    it("needs a real rating id and some text", () => {
        expect(normalizeRatingComment({ id: "abc", comment: "hi" })).toBeNull();
        expect(normalizeRatingComment({ id: { $ne: null }, comment: "hi" })).toBeNull();
        expect(normalizeRatingComment({ id, comment: "   " })).toBeNull();
    });
});

describe("ratingShares", () => {
    it("rounds each score to a share of all answers", () => {
        expect(ratingShares({ good: 6, fine: 3, bad: 1 })).toEqual({ total: 10, good: 60, fine: 30, bad: 10 });
        expect(ratingShares({ good: 0, fine: 0, bad: 0 })).toEqual({ total: 0, good: 0, fine: 0, bad: 0 });
    });
});
