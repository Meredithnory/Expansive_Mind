import { describe, expect, it } from "vitest";
import {
    PLAN_ENTITLEMENTS,
    applyStoredPlanConfig,
    defaultPlanConfig,
    resolvePlan,
} from "./plan-config";

describe("plan entitlements", () => {
    it("keeps anonymous access intentionally narrow", () => {
        expect(resolvePlan()).toBe("guest");
        expect(PLAN_ENTITLEMENTS.guest).toEqual({
            search: 3,
            discover: 1,
            chat: 0,
            scholar_search: 0,
            projects: 0,
        });
    });

    it("gives every account the free plan by default", () => {
        expect(resolvePlan({})).toBe("free");
        expect(resolvePlan({ plan: "pro", subscriptionStatus: "past_due" })).toBe(
            "free",
        );
    });

    it("grants Pro only for paid or trialing subscriptions", () => {
        expect(
            resolvePlan({ plan: "pro", subscriptionStatus: "active" }),
        ).toBe("pro");
        expect(
            resolvePlan({ plan: "pro", subscriptionStatus: "trialing" }),
        ).toBe("pro");
        expect(PLAN_ENTITLEMENTS.pro.discover).toBe(40);
        expect(PLAN_ENTITLEMENTS.pro.scholar_search).toBe(25);
        expect(PLAN_ENTITLEMENTS.pro.projects).toBe(50);
    });

    it("keeps projects as a logged-in feature with a small free lifetime allowance", () => {
        expect(PLAN_ENTITLEMENTS.guest.projects).toBe(0);
        expect(PLAN_ENTITLEMENTS.free.projects).toBe(3);
        expect(PLAN_ENTITLEMENTS.pro.projects).toBe(50);
    });

    it("keeps complimentary Pro separate from Stripe status", () => {
        expect(
            resolvePlan({
                plan: "free",
                subscriptionStatus: "none",
                accessOverride: "pro",
            }),
        ).toBe("pro");
    });
});

describe("stored plan configuration", () => {
    const fallback = {
        prices: {
            month: { amount: 1200, currency: "usd", stripePriceId: "price_month_env" },
            year: { amount: 9900, currency: "usd", stripePriceId: "price_year_env" },
        },
        entitlements: structuredClone(PLAN_ENTITLEMENTS),
    };

    it("uses defaults when nothing is stored", () => {
        expect(applyStoredPlanConfig(null, fallback)).toEqual(fallback);
        expect(applyStoredPlanConfig(undefined, defaultPlanConfig()).entitlements).toEqual(
            PLAN_ENTITLEMENTS,
        );
    });

    it("does not let blank stored Stripe IDs overwrite env fallbacks", () => {
        const merged = applyStoredPlanConfig(
            {
                prices: {
                    month: { amount: 1500, currency: "usd", stripePriceId: "" },
                    year: { amount: 8800, currency: "usd", stripePriceId: "" },
                },
            },
            fallback,
        );
        expect(merged.prices.month.amount).toBe(1500);
        expect(merged.prices.year.amount).toBe(8800);
        expect(merged.prices.month.stripePriceId).toBe("price_month_env");
        expect(merged.prices.year.stripePriceId).toBe("price_year_env");
    });

    it("prefers Stripe IDs saved from the admin portal", () => {
        const merged = applyStoredPlanConfig(
            {
                prices: {
                    month: { amount: 1500, currency: "usd", stripePriceId: "price_month_admin" },
                    year: { amount: 8800, currency: "usd", stripePriceId: "price_year_admin" },
                },
            },
            fallback,
        );
        expect(merged.prices.month.stripePriceId).toBe("price_month_admin");
        expect(merged.prices.year.stripePriceId).toBe("price_year_admin");
    });
});
