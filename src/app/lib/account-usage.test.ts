import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "./plan-config";
import { buildAccountQuota, buildMonthlyQuota } from "./account-usage";
import { quotaPeriod } from "./quota-period";

const now = new Date("2026-09-22T12:00:00.000Z");

describe("account quota reporting", () => {
    it("keeps free Discovery on a lifetime counter and Pro on the current month", () => {
        expect(quotaPeriod("free", "discover", now)).toBe("lifetime");
        expect(quotaPeriod("pro", "discover", now)).toBe("2026-09");
        expect(quotaPeriod("free", "search", now)).toBe("2026-09");
    });

    it("shows this period against the plan limit and ignores older months", () => {
        const [account] = buildAccountQuota({
            now,
            entitlements: PLAN_ENTITLEMENTS,
            users: [
                {
                    id: "pro-1",
                    firstName: "Ada",
                    lastName: "Lovelace",
                    email: "ada@example.com",
                    plan: "pro",
                    subscriptionStatus: "active",
                },
            ],
            counters: [
                {
                    userID: "pro-1",
                    feature: "discover",
                    period: "2026-08",
                    count: 40,
                },
                {
                    userID: "pro-1",
                    feature: "discover",
                    period: "2026-09",
                    count: 6,
                },
                {
                    userID: "pro-1",
                    feature: "search",
                    period: "2026-09",
                    count: 11,
                },
            ],
        });

        expect(account.plan).toBe("pro");
        expect(account.features.find((cell) => cell.feature === "discover")).toEqual({
            feature: "discover",
            used: 6,
            limit: 20,
            period: "2026-09",
        });
        expect(account.features.find((cell) => cell.feature === "search")).toMatchObject({
            used: 11,
            limit: 300,
        });
        expect(account.features.find((cell) => cell.feature === "projects")).toMatchObject({
            used: 0,
            limit: 50,
        });
    });

    it("fills the last six months even when a month has no counters", () => {
        const months = buildMonthlyQuota(
            [
                { period: "2026-09", feature: "search", used: 14 },
                { period: "2026-07", feature: "discover", used: 3 },
                { period: "lifetime", feature: "discover", used: 9 },
            ],
            now,
        );

        expect(months.map((row) => row.period)).toEqual([
            "2026-09",
            "2026-08",
            "2026-07",
            "2026-06",
            "2026-05",
            "2026-04",
        ]);
        expect(months[0].totals.search).toBe(14);
        expect(months[1].totals.search).toBe(0);
        expect(months[2].totals.discover).toBe(3);
        expect(months[0].totals.discover).toBe(0);
    });
});
