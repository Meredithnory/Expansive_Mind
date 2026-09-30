import { describe, expect, it } from "vitest";
import { joinedLabel } from "./forum-client";

describe("joinedLabel", () => {
    it("shows the month and year someone signed up", () => {
        expect(joinedLabel("2026-09-14T18:20:00.000Z")).toBe("Joined September 2026");
    });

    it("reads the date in UTC, so the month doesn't shift by time zone", () => {
        expect(joinedLabel("2026-10-01T00:30:00.000Z")).toBe("Joined October 2026");
    });

    it("shows nothing when the date is missing or unreadable", () => {
        expect(joinedLabel(undefined)).toBeNull();
        expect(joinedLabel("")).toBeNull();
        expect(joinedLabel("not a date")).toBeNull();
    });
});
