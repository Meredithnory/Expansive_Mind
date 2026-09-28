import { describe, expect, it } from "vitest";
import { coatColor, parseProfileColor, profileColorHex } from "./profile-colors";

describe("profile colors", () => {
    it("accepts only known colors", () => {
        expect(parseProfileColor("teal")).toBe("teal");
        expect(parseProfileColor("red")).toBeNull();
        expect(parseProfileColor(undefined)).toBeNull();
    });

    it("falls back to pink for missing or unknown colors", () => {
        expect(profileColorHex(undefined)).toBe("#ff0084");
        expect(profileColorHex("nope")).toBe("#ff0084");
        expect(profileColorHex("blue")).toBe("#0ab1ff");
    });

    it("includes the classic white coat with readable ink", () => {
        expect(parseProfileColor("white")).toBe("white");
        expect(coatColor("white")).toMatchObject({ label: "Classic white", ink: "#141418" });
        expect(coatColor("nope").id).toBe("pink");
    });
});
