import "server-only";
import connectDB from "../db/connectDB";
import UsageCounter from "../models/UsageCounter";
import {
    PLAN_ENTITLEMENTS,
    getPlanEntitlements,
    type Plan,
    type QuotaFeature,
} from "./plan-config";
import { summarizeGuestCounters } from "./guest-usage";
import { hashQuotaIdentity } from "./quota-identity";

export {
    PLAN_ENTITLEMENTS,
    getPlanEntitlements,
    resolvePlan,
    type Plan,
    type QuotaFeature,
} from "./plan-config";

function periodFor(plan: Plan, feature: QuotaFeature, now: Date) {
    if (plan === "guest" && (feature === "discover" || feature === "projects")) {
        return "lifetime";
    }
    if (plan === "guest") {
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    }
    if (plan === "free" && (feature === "discover" || feature === "projects")) {
        return "lifetime";
    }
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function expirationFor(period: string, now: Date) {
    if (period === "lifetime") {
        return new Date("2100-01-01T00:00:00.000Z");
    }
    if (period.length === 10) {
        return new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 8,
            ),
        );
    }
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1),
    );
}

export async function consumeQuota(input: {
    plan: Plan;
    feature: QuotaFeature;
    identity: string;
    userID?: string;
    unlimited?: boolean;
}) {
    if (input.unlimited) {
        return {
            allowed: true,
            unlimited: true,
            limit: null,
            used: 0,
            remaining: null,
        };
    }
    await connectDB();
    const limit = (await getPlanEntitlements(input.plan))[input.feature];
    if (limit <= 0) {
        return { allowed: false, limit, used: 0, remaining: 0 };
    }

    const now = new Date();
    const period = periodFor(input.plan, input.feature, now);
    const identityHash = hashQuotaIdentity(input.identity);
    const id = hashQuotaIdentity(
        `quota:${identityHash}:${input.feature}:${period}`,
    );
    let record: { count: number } | null = null;
    try {
        record = await UsageCounter.findOneAndUpdate(
            { _id: id, count: { $lt: limit } },
            {
                $inc: { count: 1 },
                $setOnInsert: {
                    identityHash,
                    userID: input.userID,
                    feature: input.feature,
                    period,
                    expiresAt: expirationFor(period, now),
                },
            },
            { upsert: true, new: true },
        ).lean<{ count: number }>();
    } catch (error: any) {
        if (error?.code !== 11000) throw error;
    }

    if (!record) {
        const existing = await UsageCounter.findById(id).lean<{
            count: number;
        }>();
        return {
            allowed: false,
            limit,
            used: existing?.count ?? limit,
            remaining: 0,
        };
    }

    return {
        allowed: record.count <= limit,
        limit,
        used: record.count,
        remaining: Math.max(0, limit - record.count),
    };
}

export async function refundQuota(input: {
    plan: Plan;
    feature: QuotaFeature;
    identity: string;
}) {
    await connectDB();
    const now = new Date();
    const period = periodFor(input.plan, input.feature, now);
    const identityHash = hashQuotaIdentity(input.identity);
    const id = hashQuotaIdentity(
        `quota:${identityHash}:${input.feature}:${period}`,
    );
    await UsageCounter.updateOne(
        { _id: id, count: { $gt: 0 } },
        { $inc: { count: -1 } },
    );
}

export async function getQuotaSnapshot(input: {
    plan: Plan;
    identity: string;
    userID?: string;
    unlimited?: boolean;
}) {
    if (input.unlimited) {
        return Object.fromEntries(
            (Object.keys(PLAN_ENTITLEMENTS[input.plan]) as QuotaFeature[]).map(
                (feature) => [
                    feature,
                    {
                        unlimited: true,
                        limit: null,
                        used: 0,
                        remaining: null,
                    },
                ],
            ),
        );
    }
    await connectDB();
    const now = new Date();
    const identityHash = hashQuotaIdentity(input.identity);
    const entitlements = await getPlanEntitlements(input.plan);

    const features = Object.keys(entitlements) as QuotaFeature[];
    const idsByFeature = new Map(
        features.map((feature) => [
            feature,
            hashQuotaIdentity(
                `quota:${identityHash}:${feature}:${periodFor(input.plan, feature, now)}`,
            ),
        ]),
    );
    const records = await UsageCounter.find({
        _id: { $in: [...idsByFeature.values()] },
    })
        .select({ _id: 1, count: 1 })
        .lean<Array<{ _id: unknown; count: number }>>();
    const countsById = new Map(
        records.map((record) => [String(record._id), record.count]),
    );
    const entries = features.map((feature) => {
        const limit = entitlements[feature];
        const used = countsById.get(idsByFeature.get(feature)!) ?? 0;
        return [
            feature,
            { limit, used, remaining: Math.max(0, limit - used) },
        ] as const;
    });

    return Object.fromEntries(entries);
}

export async function listGuestQuotaNetworks(limit = 40) {
    await connectDB();
    const entitlements = await getPlanEntitlements("guest");
    const records = await UsageCounter.find({
        $or: [{ userID: { $exists: false } }, { userID: null }],
    })
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean<{
            identityHash: string;
            feature: string;
            count: number;
            updatedAt?: Date;
        }[]>();

    return summarizeGuestCounters(
        records.map((record) => ({
            identityHash: record.identityHash,
            feature: record.feature,
            count: record.count,
            updatedAt: record.updatedAt?.toISOString?.(),
        })),
        entitlements,
    ).slice(0, limit);
}
