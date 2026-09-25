import "server-only";
import Stripe from "stripe";

/** Cloud-based AI workspace for individuals. Stripe Tax AI catalog: AIaaS - Cloud Based - Personal Use. */
export const RESEARCHER_PRO_TAX_CODE = "txcd_10105001";

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

export async function ensureStripeProductTaxCode(productId: string) {
    const stripe = getStripe();
    const product = await stripe.products.retrieve(productId);
    const current =
        typeof product.tax_code === "string"
            ? product.tax_code
            : product.tax_code?.id;
    if (current) return product;
    return stripe.products.update(productId, {
        tax_code: RESEARCHER_PRO_TAX_CODE,
    });
}
