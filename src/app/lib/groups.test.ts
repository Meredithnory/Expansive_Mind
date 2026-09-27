import { describe, expect, it } from "vitest";
import {
    isInviteCode,
    newInviteCode,
    parseGroupName,
    parseGroupText,
} from "./groups";
import { paperLinesHref, parseLineRange } from "./paper-lines";

describe("group input", () => {
    it("trims and bounds group names", () => {
        expect(parseGroupName("  Smith   Lab ")).toBe("Smith Lab");
        expect(parseGroupName("")).toBeNull();
        expect(parseGroupName("x".repeat(61))).toBeNull();
        expect(parseGroupName(42)).toBeNull();
    });

    it("keeps paragraph breaks in notes but caps length", () => {
        expect(parseGroupText("a\r\n\n\n\nb", 100)).toBe("a\n\nb");
        expect(parseGroupText("x".repeat(101), 100)).toBeNull();
    });

    it("makes invite codes the validator accepts", () => {
        const code = newInviteCode();
        expect(isInviteCode(code)).toBe(true);
        expect(isInviteCode("short")).toBe(false);
        expect(isInviteCode(`${code}/../x`)).toBe(false);
    });

    it("parses bounded line ranges", () => {
        expect(parseLineRange("12-15")).toEqual({ start: 12, end: 15 });
        expect(parseLineRange("7")).toEqual({ start: 7, end: 7 });
        expect(parseLineRange("15-12")).toBeNull();
        expect(parseLineRange("1-900")).toBeNull();
        expect(parseLineRange("abc")).toBeNull();
    });

    it("builds a reader link with the line range", () => {
        expect(paperLinesHref("/paperchatbot/nih/123", 4, 9)).toBe("/paperchatbot/nih/123?lines=4-9");
        expect(paperLinesHref("/paperchatbot/nih/123?idName=pmid", 4, 4)).toBe("/paperchatbot/nih/123?idName=pmid&lines=4-4");
    });
});
