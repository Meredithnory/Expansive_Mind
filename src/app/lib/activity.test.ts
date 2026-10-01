import { describe, expect, it } from "vitest";
import {
    LIVE_WINDOW_MS,
    activityPath,
    feedText,
    liveVisitors,
    normalizeActivity,
    parseFeedHours,
    parsePersonRef,
} from "./activity";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const USER = "0123456789abcdef01234567";

describe("activityPath", () => {
    it("keeps the path and drops the query and hash", () => {
        expect(activityPath("/paperchatbot/nih/PMC123?token=secret#fig2")).toEqual({
            page: "paper",
            path: "/paperchatbot/nih/PMC123",
        });
        expect(activityPath("/discover/")).toEqual({ page: "discover", path: "/discover" });
    });

    it("ignores admin, untracked, and off-site paths", () => {
        expect(activityPath("/admin/live")).toBeNull();
        expect(activityPath("/reset-password")).toBeNull();
        expect(activityPath("//evil.example/discover")).toBeNull();
        expect(activityPath("https://expansivemind.ai/discover")).toBeNull();
        expect(activityPath(42)).toBeNull();
    });
});

describe("normalizeActivity", () => {
    it("accepts a page view, a discovery, and a search", () => {
        expect(normalizeActivity({ kind: "page_view", path: "/brief/abc" })).toEqual({
            kind: "page_view",
            page: "brief",
            path: "/brief/abc",
            detail: null,
        });
        expect(normalizeActivity({ kind: "discover", detail: "  CAR-T\nin lupus  " })).toEqual({
            kind: "discover",
            page: "discover",
            path: null,
            detail: "CAR-T in lupus",
        });
        expect(normalizeActivity({ kind: "search", detail: "x".repeat(500) })?.detail).toHaveLength(300);
    });

    it("rejects unknown kinds and empty details", () => {
        expect(normalizeActivity({ kind: "delete_everything" })).toBeNull();
        expect(normalizeActivity({ kind: "search", detail: "   " })).toBeNull();
        expect(normalizeActivity(null)).toBeNull();
    });
});

describe("parsePersonRef and parseFeedHours", () => {
    it("reads account ids and guest keys, nothing else", () => {
        expect(parsePersonRef(`user:${USER}`)).toEqual({ type: "user", id: USER });
        expect(parsePersonRef(`guest:${KEY_A}`)).toEqual({ type: "guest", key: KEY_A });
        expect(parsePersonRef(`user:${KEY_A}`)).toBeNull();
        expect(parsePersonRef(`guest:${USER}`)).toBeNull();
        expect(parsePersonRef("user:{$ne:null}")).toBeNull();
    });

    it("falls back to 24 hours", () => {
        expect(parseFeedHours("1")).toBe(1);
        expect(parseFeedHours("168")).toBe(168);
        expect(parseFeedHours("5")).toBe(24);
        expect(parseFeedHours(null)).toBe(24);
    });
});

describe("feedText", () => {
    it("says what happened in words", () => {
        expect(feedText("page_view", "discover")).toBe("Opened Discover");
        expect(feedText("page_view", "paper")).toBe("Opened a paper");
        expect(feedText("rating", null, "bad")).toBe("Rated Bad");
        expect(feedText("share")).toBe("Created a share link");
    });
});

describe("liveVisitors", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const ago = (ms: number) => new Date(now - ms);

    it("lists visitors whose tab reported in recently, newest first", () => {
        const live = liveVisitors(
            [
                { visitorKey: KEY_A, userID: USER, lastSeenAt: ago(20_000), lastPage: "discover", secondsByPage: { discover: 90, home: 30 } },
                { visitorKey: KEY_B, lastSeenAt: ago(5_000), lastPage: "search" },
            ],
            [],
            now,
        );
        expect(live.map((row) => row.visitorKey)).toEqual([KEY_B, KEY_A]);
        expect(live[1]).toMatchObject({ userID: USER, page: "discover", secondsToday: 120 });
    });

    it("drops visitors who went away or went quiet", () => {
        const live = liveVisitors(
            [
                { visitorKey: KEY_A, lastSeenAt: ago(2_000), lastPage: "discover", away: true },
                { visitorKey: KEY_B, lastSeenAt: ago(LIVE_WINDOW_MS + 1_000), lastPage: "search" },
            ],
            [],
            now,
        );
        expect(live).toEqual([]);
    });

    it("counts a page view that came after going away, and shows its path", () => {
        const live = liveVisitors(
            [{ visitorKey: KEY_A, lastSeenAt: ago(10_000), lastPage: "discover", away: true }],
            [{ visitorKey: KEY_A, at: ago(3_000), page: "paper", path: "/paperchatbot/nih/PMC1" }],
            now,
        );
        expect(live).toEqual([
            expect.objectContaining({ visitorKey: KEY_A, page: "paper", path: "/paperchatbot/nih/PMC1" }),
        ]);
    });

    it("keeps the path while the latest tab report is on the same page", () => {
        const live = liveVisitors(
            [{ visitorKey: KEY_A, lastSeenAt: ago(1_000), lastPage: "paper" }],
            [{ visitorKey: KEY_A, at: ago(30_000), page: "paper", path: "/paperchatbot/nih/PMC1" }],
            now,
        );
        expect(live[0].path).toBe("/paperchatbot/nih/PMC1");
    });
});
