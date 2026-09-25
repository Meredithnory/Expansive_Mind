import { describe, expect, it } from "vitest";
import { generateShareSlug, isValidShareSlug } from "./share-slug";

describe("share slugs", () => {
    it("generates a URL-safe slug in the accepted length range", () => {
        const slug = generateShareSlug();

        expect(slug).toMatch(/^[A-Za-z0-9_-]{12}$/);
        expect(isValidShareSlug(slug)).toBe(true);
        expect(generateShareSlug()).not.toBe(slug);
    });

    it("accepts only 10–24 URL-safe characters", () => {
        expect(isValidShareSlug("a".repeat(10))).toBe(true);
        expect(isValidShareSlug("a".repeat(24))).toBe(true);
        expect(isValidShareSlug("slug_with-dash")).toBe(true);
        expect(isValidShareSlug("a".repeat(9))).toBe(false);
        expect(isValidShareSlug("a".repeat(25))).toBe(false);
        expect(isValidShareSlug("has space!!")).toBe(false);
        expect(isValidShareSlug("")).toBe(false);
    });
});
