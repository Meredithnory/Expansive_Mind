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
        expect(PLAN_ENTITLEMENTS.pro.discover).toBe(20);
        expect(PLAN_ENTITLEMENTS.pro.scholar_search).toBe(25);
        expect(PLAN_ENTITLEMENTS.pro.projects).toBe(50);
    });

    it("gives free accounts 5 discoveries, 20 searches, and 30 AI questions a month", () => {
        expect(PLAN_ENTITLEMENTS.free).toMatchObject({ discover: 5, search: 20, chat: 30 });
        expect(PLAN_ENTITLEMENTS.guest.discover).toBe(1);
        expect(PLAN_ENTITLEMENTS.guest.chat).toBe(0);
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

    it("replaces the previous Pro Discovery default of 40 with the current allowance", () => {
        const merged = applyStoredPlanConfig(
            {
                entitlements: {
                    pro: {
                        search: 300,
                        discover: 40,
                        chat: 100,
                        scholar_search: 25,
                        projects: 50,
                    },
                },
            },
            fallback,
        );
        expect(merged.entitlements.pro.discover).toBe(20);
    });

    it("keeps a custom Pro Discovery allowance", () => {
        const merged = applyStoredPlanConfig(
            {
                entitlements: {
                    pro: {
                        search: 300,
                        discover: 12,
                        chat: 100,
                        scholar_search: 25,
                        projects: 50,
                    },
                },
            },
            fallback,
        );
        expect(merged.entitlements.pro.discover).toBe(12);
    });

    it("moves a config saved with the old free defaults to the new monthly limits", () => {
        const oldFree = { search: 20, discover: 2, chat: 5, scholar_search: 0, projects: 3 };
        const beforeChange = applyStoredPlanConfig(
            { entitlements: { free: oldFree }, updatedAt: "2026-09-20T12:00:00.000Z" },
            fallback,
        );
        expect(beforeChange.entitlements.free).toMatchObject({ discover: 5, chat: 30, search: 20 });

        // Something Meredith chose herself before the change stays.
        const custom = applyStoredPlanConfig(
            { entitlements: { free: { ...oldFree, discover: 3, chat: 12 } }, updatedAt: "2026-09-20T12:00:00.000Z" },
            fallback,
        );
        expect(custom.entitlements.free).toMatchObject({ discover: 3, chat: 12 });
    });

    it("keeps free limits saved in /admin after the change, even the old numbers", () => {
        const merged = applyStoredPlanConfig(
            {
                entitlements: { free: { search: 20, discover: 2, chat: 5, scholar_search: 0, projects: 3 } },
                updatedAt: "2026-10-02T09:00:00.000Z",
            },
            fallback,
        );
        expect(merged.entitlements.free).toMatchObject({ discover: 2, chat: 5 });
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
