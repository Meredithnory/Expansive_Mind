import { describe, expect, it } from "vitest";
import { PAYMENTS_VISIBLE } from "./payments";
import {
    countOf,
    limitRenewsOn,
    monthlyLimitMessage,
    notOnPlanMessage,
} from "./plan-messages";

const now = new Date("2026-10-14T18:00:00.000Z");

describe("limit messages while paid plans are hidden", () => {
    it("keeps paid plans hidden", () => {
        expect(PAYMENTS_VISIBLE).toBe(false);
    });

    it("says monthly limits come back on the 1st, across the year end", () => {
        expect(limitRenewsOn(now)).toBe("November 1");
        expect(limitRenewsOn(new Date("2026-12-31T23:59:00.000Z"))).toBe("January 1");
    });

    it("names the allowance and when it comes back, never an upgrade", () => {
        expect(monthlyLimitMessage("discover", 5, { now, upgrade: true })).toBe(
            "You've used your 5 discoveries for this month. You get more on November 1.",
        );
        expect(monthlyLimitMessage("search", 20, { now })).toBe(
            "You've used your 20 paper searches for this month. You get more on November 1.",
        );
        expect(monthlyLimitMessage("chat", 1, { now })).toContain("your 1 paper assistant question for");
        expect(monthlyLimitMessage("discover", null, { now })).toContain("your discoveries for this month");
    });

    it("says a feature isn't on the account instead of selling Pro", () => {
        expect(notOnPlanMessage("Figure analysis")).toBe("Figure analysis isn't available on your account.");
        expect(countOf("discover", 3)).toBe("3 discoveries");
    });
});
