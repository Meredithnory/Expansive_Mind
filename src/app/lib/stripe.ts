import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is required.");
    }
    if (!stripeClient) {
        stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripeClient;
}

export function getStripePrice(interval: "month" | "year") {
    const priceId =
        interval === "year"
            ? process.env.STRIPE_PRICE_ANNUAL
            : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) {
        throw new Error(
            interval === "year"
                ? "STRIPE_PRICE_ANNUAL is required."
                : "STRIPE_PRICE_MONTHLY is required.",
        );
    }
    return priceId;
}
