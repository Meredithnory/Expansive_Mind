import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "../lib/plan-config";
import PlanConfig from "./PlanConfig";

describe("PlanConfig", () => {
    it("allows saving prices before Stripe IDs exist", async () => {
        const doc = new PlanConfig({
            _id: "primary",
            prices: {
                month: { amount: 1200, currency: "usd", stripePriceId: "" },
                year: { amount: 9900, currency: "usd", stripePriceId: "" },
            },
            entitlements: PLAN_ENTITLEMENTS,
        });
        await expect(doc.validate()).resolves.toBeUndefined();
    });
});
