import { describe, expect, it } from "vitest";
import {
    BIO_MAX,
    EMPTY_BADGE,
    badgeTagLine,
    cleanBio,
    describeOutfit,
    parseBadge,
    parseBadgePatch,
} from "./lab-badge";

describe("lab badge", () => {
    it("fills missing or unknown stored values with defaults", () => {
        expect(parseBadge(undefined)).toEqual(EMPTY_BADGE);
        expect(parseBadge({ role: "Wizard", head: "crown", hand: "flask", field: 7 })).toEqual({
            ...EMPTY_BADGE,
            hand: "flask",
        });
    });

    it("patches only the keys sent and names the first bad one", () => {
        expect(parseBadgePatch({ neck: "stethoscope" })).toEqual({ patch: { neck: "stethoscope" } });
        expect(parseBadgePatch({ sidekick: "cat" })).toEqual({ error: "Pick one of the sidekick options." });
        expect(parseBadgePatch(["goggles"])).toEqual({ error: "A valid badge is required." });
    });

    it("keeps the bio's paragraphs but not its control characters", () => {
        expect(cleanBio("  a\u0007b\n\n\n\nc  ")).toBe("a b\n\nc");
        expect(cleanBio("x".repeat(BIO_MAX + 10))).toHaveLength(BIO_MAX);
        expect(cleanBio(null)).toBeNull();
    });

    it("writes the tag line and outfit in words", () => {
        expect(badgeTagLine({ role: "PhD student", field: "Neuroscience" })).toBe("PhD student · Neuroscience");
        expect(badgeTagLine({ role: null, field: "Neuroscience" })).toBe("Neuroscience");
        expect(badgeTagLine(null)).toBe("");
        expect(describeOutfit("Signal pink", { ...EMPTY_BADGE, head: "goggles", sidekick: "mouse" })).toBe(
            "Signal pink coat · Safety goggles · Lab mouse",
        );
    });
});
