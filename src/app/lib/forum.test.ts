import { describe, expect, it } from "vitest";
import { canPostPublicly, isTag, parseTags, publicName } from "./forum";

describe("forum rules", () => {
    it("normalizes up to three tags", () => {
        expect(parseTags("#Gut-Microbiome, crispr CRISPR #x  aging  extra")).toEqual([
            "gut-microbiome",
            "crispr",
            "aging",
        ]);
        expect(parseTags(["<script>", "ok-tag"])).toEqual(["script", "ok-tag"]);
    });

    it("validates tag query values", () => {
        expect(isTag("gut-microbiome")).toBe(true);
        expect(isTag("-bad")).toBe(false);
        expect(isTag("a b")).toBe(false);
    });

    it("shows first name and last initial publicly", () => {
        expect(publicName("Meredith", "Staton")).toBe("Meredith S.");
        expect(publicName("Priya", "")).toBe("Priya");
        expect(publicName("", "X")).toBe("Researcher");
    });

    it("makes new accounts wait a day before posting", () => {
        const now = Date.parse("2026-09-26T12:00:00Z");
        expect(canPostPublicly("2026-09-26T00:00:00Z", now)).toBe(false);
        expect(canPostPublicly("2026-09-25T11:00:00Z", now)).toBe(true);
    });
});
