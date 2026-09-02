import { describe, expect, it } from "vitest";
import Stripe from "stripe";

describe("Stripe webhook signatures", () => {
    const stripe = new Stripe("sk_test_placeholder");
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({
        id: "evt_test",
        object: "event",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_test" } },
    });

    it("accepts a payload signed by the configured endpoint secret", () => {
        const signature = stripe.webhooks.generateTestHeaderString({
            payload,
            secret,
        });
        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            secret,
        );
        expect(event.id).toBe("evt_test");
    });

    it("rejects a forged signature", () => {
        expect(() =>
            stripe.webhooks.constructEvent(payload, "t=1,v1=forged", secret),
        ).toThrow(/signature/i);
    });
});
