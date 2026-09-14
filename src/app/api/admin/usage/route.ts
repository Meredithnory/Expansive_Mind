import { NextResponse } from "next/server";
import UsageEvent from "../../../models/UsageEvent";
import User from "../../../models/User";
import { withAdmin } from "../../../lib/admin";
import { getPlanConfig } from "../../../lib/plan-config";
import { listGuestQuotaNetworks } from "../../../lib/entitlements";
import { fillDailySeries, type DailyPoint } from "../../../lib/admin-overview";

const DAY_MS = 24 * 60 * 60 * 1_000;

export const GET = withAdmin(async () => {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const priorSince = new Date(now.getTime() - 60 * DAY_MS);
    const [usage, dailyRows, priorRows, users, config, guests] =
        await Promise.all([
            UsageEvent.aggregate([
                { $match: { occurredAt: { $gte: since } } },
                {
                    $group: {
                        _id: {
                            feature: "$feature",
                            provider: "$provider",
                        },
                        calls: { $sum: "$callCount" },
                        inputTokens: { $sum: "$inputTokens" },
                        outputTokens: { $sum: "$outputTokens" },
                        estimatedCostMicros: {
                            $sum: "$estimatedCostMicros",
                        },
                        failures: {
                            $sum: { $cond: ["$success", 0, 1] },
                        },
                    },
                },
                { $sort: { estimatedCostMicros: -1 } },
            ]),
            UsageEvent.aggregate([
                { $match: { occurredAt: { $gte: since } } },
                {
                    $group: {
                        _id: {
                            day: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$occurredAt",
                                },
                            },
                            feature: "$feature",
                        },
                        calls: { $sum: "$callCount" },
                        estimatedCostMicros: {
                            $sum: "$estimatedCostMicros",
                        },
                        failures: {
                            $sum: { $cond: ["$success", 0, 1] },
                        },
                    },
                },
            ]),
            UsageEvent.aggregate([
                {
                    $match: {
                        occurredAt: { $gte: priorSince, $lt: since },
                    },
                },
                {
                    $group: {
                        _id: null,
                        calls: { $sum: "$callCount" },
                        estimatedCostMicros: {
                            $sum: "$estimatedCostMicros",
                        },
                        failures: {
                            $sum: { $cond: ["$success", 0, 1] },
                        },
                    },
                },
            ]),
            User.aggregate([
                {
                    $group: {
                        _id: "$plan",
                        count: { $sum: 1 },
                    },
                },
            ]),
            getPlanConfig(),
            listGuestQuotaNetworks(40),
        ]);

    const folded = new Map<string, DailyPoint>();
    for (const row of dailyRows) {
        const date = String(row._id.day);
        const current = folded.get(date) ?? {
            date,
            calls: 0,
            costUsd: 0,
            failures: 0,
            features: {},
        };
        const costUsd = Number(row.estimatedCostMicros || 0) / 1_000_000;
        current.calls += Number(row.calls || 0);
        current.costUsd += costUsd;
        current.failures += Number(row.failures || 0);
        current.features[String(row._id.feature)] = {
            calls: Number(row.calls || 0),
            costUsd,
        };
        folded.set(date, current);
    }

    const estimatedCostMicros = usage.reduce(
        (total, row) => total + Number(row.estimatedCostMicros || 0),
        0,
    );
    const prior = priorRows[0] ?? {};
    return NextResponse.json(
        {
            rangeDays: 30,
            estimatedCostUsd: estimatedCostMicros / 1_000_000,
            usage: usage.map((row) => ({
                feature: row._id.feature,
                provider: row._id.provider,
                calls: row.calls,
                inputTokens: row.inputTokens,
                outputTokens: row.outputTokens,
                estimatedCostUsd:
                    Number(row.estimatedCostMicros || 0) / 1_000_000,
                failures: row.failures,
            })),
            daily: fillDailySeries([...folded.values()], 30, now),
            prior: {
                calls: Number(prior.calls || 0),
                estimatedCostUsd:
                    Number(prior.estimatedCostMicros || 0) / 1_000_000,
                failures: Number(prior.failures || 0),
            },
            users: Object.fromEntries(
                users.map((row) => [row._id || "free", row.count]),
            ),
            monthlyListPrice: config.prices.month.amount / 100,
            guests,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
