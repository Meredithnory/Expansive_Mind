import { describe, expect, it } from "vitest";
import {
    audiencePage,
    clampAudienceSeconds,
    formatDuration,
    summarizeAudience,
} from "./audience";

describe("audiencePage", () => {
    it("maps product routes and skips the admin portal", () => {
        expect(audiencePage("/discover")).toBe("discover");
        expect(audiencePage("/searchpaper")).toBe("search");
        expect(audiencePage("/paperchatbot/nih/123")).toBe("paper");
        expect(audiencePage("/admin")).toBeNull();
        expect(audiencePage("/admin/login")).toBeNull();
    });
});

describe("clampAudienceSeconds", () => {
    it("drops empty pings and caps a single update", () => {
        expect(clampAudienceSeconds(0)).toBe(0);
        expect(clampAudienceSeconds(12.4)).toBe(12);
        expect(clampAudienceSeconds(400)).toBe(40);
    });
});

describe("summarizeAudience", () => {
    it("counts days, time, and where people went next", () => {
        const summary = summarizeAudience(
            [
                {
                    day: "2026-09-20",
                    visitorKey: "a",
                    signedIn: true,
                    secondsByPage: { discover: 90, search: 30 },
                    moves: { discover__search: 1 },
                },
                {
                    day: "2026-09-21",
                    visitorKey: "a",
                    signedIn: true,
                    secondsByPage: { pricing: 40 },
                    moves: { search__pricing: 1 },
                },
                {
                    day: "2026-09-21",
                    visitorKey: "b",
                    secondsByPage: { discover: 20 },
                },
            ],
            3,
            new Date("2026-09-21T18:00:00.000Z"),
        );

        expect(summary.visitors).toBe(2);
        expect(summary.signedInVisitors).toBe(1);
        expect(summary.seconds).toBe(180);
        expect(summary.daily.map((row) => row.visitors)).toEqual([0, 1, 2]);
        expect(summary.pages[0]).toMatchObject({ page: "discover", seconds: 110 });
        expect(summary.destinations[0].label).toBe("Discover → Search");
        expect(summary.returnDays.find((row) => row.label === "2 days")?.visitors).toBe(1);
    });

    it("merges visits from the same account and keeps guests unnamed", () => {
        const summary = summarizeAudience(
            [
                {
                    day: "2026-09-21",
                    visitorKey: "browser-a",
                    userId: "user-1",
                    account: {
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        plan: "pro",
                    },
                    secondsByPage: { discover: 50 },
                },
                {
                    day: "2026-09-21",
                    visitorKey: "browser-b",
                    userId: "user-1",
                    secondsByPage: { search: 10 },
                },
                {
                    day: "2026-09-21",
                    visitorKey: "guest-browser",
                    secondsByPage: { pricing: 15 },
                },
            ],
            1,
            new Date("2026-09-21T18:00:00.000Z"),
        );

        expect(summary.visitors).toBe(2);
        expect(summary.people).toHaveLength(2);
        expect(summary.people[0]).toMatchObject({
            name: "Ada Lovelace",
            email: "ada@example.com",
            plan: "pro",
            guest: false,
            seconds: 60,
        });
        expect(summary.people[1]).toMatchObject({
            name: "Guest",
            email: null,
            guest: true,
        });
    });
});

describe("formatDuration", () => {
    it("reads as time spent", () => {
        expect(formatDuration(45)).toBe("45s");
        expect(formatDuration(180)).toBe("3m");
        expect(formatDuration(3900)).toBe("1h 5m");
    });
});
