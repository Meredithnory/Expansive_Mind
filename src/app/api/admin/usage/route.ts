import { NextResponse } from "next/server";
import UsageEvent from "../../../models/UsageEvent";
import User from "../../../models/User";
import { withAdmin } from "../../../lib/admin";
import { getPlanConfig } from "../../../lib/plan-config";
import { listGuestQuotaNetworks } from "../../../lib/entitlements";

export const GET = withAdmin(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
    const [usage, users, config, guests] = await Promise.all([
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

    const estimatedCostMicros = usage.reduce(
        (total, row) => total + Number(row.estimatedCostMicros || 0),
        0,
    );
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
            users: Object.fromEntries(
                users.map((row) => [row._id || "free", row.count]),
            ),
            monthlyListPrice: config.prices.month.amount / 100,
            guests,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
