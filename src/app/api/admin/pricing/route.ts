import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../db/connectDB";
import PlanConfigModel from "../../../models/PlanConfig";
import { withAdmin } from "../../../lib/admin";
import { recordAdminAction } from "../../../lib/admin-audit";
import {
    clearPlanConfigCache,
    getPlanConfig,
    type BillingInterval,
    type Plan,
    type QuotaFeature,
    type RuntimePlanConfig,
} from "../../../lib/plan-config";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { getStripe, isStripeConfigured } from "../../../lib/stripe";

const intervals: BillingInterval[] = ["month", "year"];
const plans: Plan[] = ["guest", "free", "pro"];
const features: QuotaFeature[] = [
    "search",
    "discover",
    "chat",
    "scholar_search",
    "projects",
];

function pricingResponse(
    config: RuntimePlanConfig,
    extra?: { warning?: string },
) {
    return {
        prices: config.prices,
        entitlements: config.entitlements,
        updatedAt: config.updatedAt,
        stripeConfigured: isStripeConfigured(),
        ...extra,
    };
}

async function resolveStripeProductId(
    current: RuntimePlanConfig["prices"],
) {
    const stripe = getStripe();
    for (const interval of intervals) {
        const priceId = current[interval].stripePriceId;
        if (!priceId) continue;
        const price = await stripe.prices.retrieve(priceId);
        return typeof price.product === "string"
            ? price.product
            : price.product.id;
    }
    const product = await stripe.products.create({
        name: "Researcher Pro",
        metadata: { managedBy: "admin-portal" },
    });
    return product.id;
}

async function syncStripePrices(
    current: RuntimePlanConfig,
    next: RuntimePlanConfig,
) {
    if (!isStripeConfigured()) {
        return {
            prices: next.prices,
            warning: next.prices.month.stripePriceId && next.prices.year.stripePriceId
                ? undefined
                : "Usage limits were saved. Checkout stays unavailable until STRIPE_SECRET_KEY is set and prices are saved again.",
        };
    }

    const stripe = getStripe();
    let productId: string | undefined;
    const prices = structuredClone(next.prices);

    for (const interval of intervals) {
        const amount = next.prices[interval].amount;
        const activePriceId = current.prices[interval].stripePriceId;
        if (amount === current.prices[interval].amount && activePriceId) {
            continue;
        }
        productId ||= await resolveStripeProductId(current.prices);
        const created = await stripe.prices.create(
            {
                product: productId,
                unit_amount: amount,
                currency: next.prices[interval].currency,
                recurring: { interval },
                metadata: {
                    managedBy: "admin-portal",
                    previousPriceId: activePriceId,
                },
            },
            {
                idempotencyKey: `admin-price-${interval}-${amount}-${activePriceId || "bootstrap"}`,
            },
        );
        prices[interval] = {
            amount,
            currency: created.currency,
            stripePriceId: created.id,
        };
    }

    return { prices };
}

export const GET = withAdmin(async () =>
    NextResponse.json(pricingResponse(await getPlanConfig()), {
        headers: { "Cache-Control": "private, no-store" },
    }),
);

export const PATCH = withAdmin(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid configuration." }, { status: 400 });
    }

    const current = await getPlanConfig();
    const next = structuredClone(current);

    for (const plan of plans) {
        for (const feature of features) {
            const value = body.entitlements?.[plan]?.[feature];
            if (value === undefined) continue;
            if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
                return NextResponse.json(
                    { error: `Invalid ${plan} ${feature} limit.` },
                    { status: 400 },
                );
            }
            next.entitlements[plan][feature] = value;
        }
    }

    for (const interval of intervals) {
        const amount = body.prices?.[interval]?.amount;
        if (amount === undefined) continue;
        if (!Number.isSafeInteger(amount) || amount < 50 || amount > 10_000_000) {
            return NextResponse.json(
                { error: `Invalid ${interval} price amount.` },
                { status: 400 },
            );
        }
        next.prices[interval].amount = amount;
    }

    const synced = await syncStripePrices(current, next);
    next.prices = synced.prices;

    await connectDB();
    const stored = await PlanConfigModel.findByIdAndUpdate(
        "primary",
        {
            $set: {
                prices: next.prices,
                entitlements: next.entitlements,
                updatedBy: request.user.email,
            },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean<any>();
    clearPlanConfigCache();

    await recordAdminAction({
        adminEmail: request.user.email,
        action: "pricing.updated",
        target: "plan-config:primary",
        before: current,
        after: next,
    });

    return NextResponse.json(
        pricingResponse(
            {
                prices: stored.prices,
                entitlements: stored.entitlements,
                updatedAt: stored.updatedAt?.toISOString?.(),
            },
            { warning: synced.warning },
        ),
    );
});
