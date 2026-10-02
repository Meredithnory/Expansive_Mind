import connectDB from "../db/connectDB";
import PlanConfigModel from "../models/PlanConfig";

const PLAN_CONFIG_CACHE_TTL_MS = 15_000;
let cachedPlanConfig:
    | { value: RuntimePlanConfig; expiresAt: number }
    | undefined;
let pendingPlanConfig: Promise<RuntimePlanConfig> | undefined;

export type Plan = "guest" | "free" | "pro";
export type QuotaFeature =
    | "search"
    | "discover"
    | "chat"
    | "scholar_search"
    | "projects";

export const PLAN_ENTITLEMENTS: Record<
    Plan,
    Record<QuotaFeature, number>
> = {
    guest: { search: 3, discover: 1, chat: 0, scholar_search: 0, projects: 0 },
    free: { search: 20, discover: 5, chat: 30, scholar_search: 0, projects: 3 },
    pro: { search: 300, discover: 20, chat: 100, scholar_search: 25, projects: 50 },
};

/**
 * Free limits changed on this day (Meredith, with paid plans hidden):
 * Discovery 2 for life became 5 a month, AI questions 5 became 30 a month.
 * A config saved in /admin before then still holds the old defaults, which
 * give way to the new ones; anything saved since is used as is.
 */
const FREE_LIMITS_CHANGED_AT = Date.parse("2026-10-01T00:00:00.000Z");
const OLD_FREE_DEFAULTS: Partial<Record<QuotaFeature, number>> = {
    discover: 2,
    chat: 5,
};

function storedFreeEntitlements(
    stored: Partial<Record<QuotaFeature, number>> | undefined,
    updatedAt: Date | string | undefined,
    fallback: Record<QuotaFeature, number>,
) {
    const merged = { ...fallback, ...stored };
    const savedAt = updatedAt ? new Date(updatedAt).getTime() : NaN;
    if (Number.isFinite(savedAt) && savedAt >= FREE_LIMITS_CHANGED_AT) {
        return merged;
    }
    for (const [feature, oldDefault] of Object.entries(OLD_FREE_DEFAULTS)) {
        const key = feature as QuotaFeature;
        if (stored?.[key] === oldDefault) merged[key] = fallback[key];
    }
    return merged;
}

export type BillingInterval = "month" | "year";
export type RuntimePlanConfig = {
    prices: Record<
        BillingInterval,
        { amount: number; currency: string; stripePriceId: string }
    >;
    entitlements: Record<Plan, Record<QuotaFeature, number>>;
    updatedAt?: string;
};

export function defaultPlanConfig(): RuntimePlanConfig {
    return {
        prices: {
            month: {
                amount: 1200,
                currency: "usd",
                stripePriceId: process.env.STRIPE_PRICE_MONTHLY || "",
            },
            year: {
                amount: 9900,
                currency: "usd",
                stripePriceId: process.env.STRIPE_PRICE_ANNUAL || "",
            },
        },
        entitlements: structuredClone(PLAN_ENTITLEMENTS),
    };
}

export function applyStoredPlanConfig(
    stored:
        | {
              prices?: Partial<RuntimePlanConfig["prices"]>;
              entitlements?: Partial<RuntimePlanConfig["entitlements"]>;
              updatedAt?: Date | string;
          }
        | null
        | undefined,
    fallback: RuntimePlanConfig = defaultPlanConfig(),
): RuntimePlanConfig {
    if (!stored) return fallback;

    const price = (interval: BillingInterval) => {
        const storedPrice = stored.prices?.[interval];
        return {
            amount:
                Number(storedPrice?.amount) || fallback.prices[interval].amount,
            currency:
                storedPrice?.currency || fallback.prices[interval].currency,
            stripePriceId:
                storedPrice?.stripePriceId ||
                fallback.prices[interval].stripePriceId,
        };
    };

    return {
        prices: {
            month: price("month"),
            year: price("year"),
        },
        entitlements: {
            guest: {
                ...fallback.entitlements.guest,
                ...stored.entitlements?.guest,
                discover: Math.max(
                    fallback.entitlements.guest.discover,
                    stored.entitlements?.guest?.discover ?? 0,
                ),
            },
            free: storedFreeEntitlements(
                stored.entitlements?.free,
                stored.updatedAt,
                fallback.entitlements.free,
            ),
            pro: {
                ...fallback.entitlements.pro,
                ...stored.entitlements?.pro,
                discover:
                    stored.entitlements?.pro?.discover === 40
                        ? fallback.entitlements.pro.discover
                        : (stored.entitlements?.pro?.discover ??
                          fallback.entitlements.pro.discover),
            },
        },
        updatedAt:
            typeof stored.updatedAt === "string"
                ? stored.updatedAt
                : stored.updatedAt?.toISOString?.(),
    };
}

async function loadPlanConfig(): Promise<RuntimePlanConfig> {
    const fallback = defaultPlanConfig();
    try {
        await connectDB();
        const stored = await PlanConfigModel.findById("primary").lean<any>();
        return applyStoredPlanConfig(stored, fallback);
    } catch (error) {
        console.warn("Plan configuration unavailable; using defaults", error);
        return fallback;
    }
}

export function clearPlanConfigCache() {
    cachedPlanConfig = undefined;
}

export async function getPlanConfig(): Promise<RuntimePlanConfig> {
    const now = Date.now();
    if (cachedPlanConfig && cachedPlanConfig.expiresAt > now) {
        return structuredClone(cachedPlanConfig.value);
    }

    pendingPlanConfig ||= loadPlanConfig();
    try {
        const value = await pendingPlanConfig;
        cachedPlanConfig = {
            value,
            expiresAt: Date.now() + PLAN_CONFIG_CACHE_TTL_MS,
        };
        return structuredClone(value);
    } finally {
        pendingPlanConfig = undefined;
    }
}

export async function getPlanEntitlements(plan: Plan) {
    return (await getPlanConfig()).entitlements[plan];
}

export function resolvePlan(user?: {
    plan?: string;
    subscriptionStatus?: string;
    accessOverride?: string;
} | null): Plan {
    if (user?.accessOverride === "pro") return "pro";
    if (
        user?.plan === "pro" &&
        (user.subscriptionStatus === "active" ||
            user.subscriptionStatus === "trialing")
    ) {
        return "pro";
    }
    return user ? "free" : "guest";
}
