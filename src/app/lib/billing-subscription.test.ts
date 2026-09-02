import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { subscriptionUserUpdate } from "./billing-subscription";

function subscription(status: Stripe.Subscription.Status) {
    return {
        id: "sub_test",
        customer: "cus_test",
        status,
        metadata: { userID: "507f1f77bcf86cd799439011" },
        items: {
            data: [
                {
                    price: { id: "price_monthly" },
                    current_period_end: 1_800_000_000,
                },
            ],
        },
    } as unknown as Stripe.Subscription;
}

describe("Stripe subscription transitions", () => {
    it("grants Pro for active and trialing subscriptions", () => {
        expect(subscriptionUserUpdate(subscription("active")).values.plan).toBe(
            "pro",
        );
        expect(subscriptionUserUpdate(subscription("trialing")).values.plan).toBe(
            "pro",
        );
    });

    it("falls back to Free when payment is not active", () => {
        for (const status of ["past_due", "canceled", "unpaid"] as const) {
            const update = subscriptionUserUpdate(subscription(status));
            expect(update.values.plan).toBe("free");
            expect(update.values.subscriptionStatus).toBe(status);
        }
    });

    it("stores the Stripe identifiers and billing period", () => {
        const update = subscriptionUserUpdate(subscription("active"));
        expect(update.customerId).toBe("cus_test");
        expect(update.values.stripeSubscriptionId).toBe("sub_test");
        expect(update.values.stripePriceId).toBe("price_monthly");
        expect(update.values.subscriptionCurrentPeriodEnd).toEqual(
            new Date(1_800_000_000 * 1_000),
        );
    });
});
