import {
    resolvePlan,
    type Plan,
    type QuotaFeature,
} from "./plan-config";
import { monthKey, quotaPeriod, QUOTA_FEATURES } from "./quota-period";

export type { QuotaFeature };
export { QUOTA_FEATURES, QUOTA_LABELS } from "./quota-period";

export type QuotaCell = {
    feature: QuotaFeature;
    used: number;
    limit: number;
    period: string;
};

export type AccountQuotaRow = {
    id: string;
    name: string;
    email: string;
    plan: Plan;
    features: QuotaCell[];
};

export type MonthlyQuotaRow = {
    period: string;
    totals: Record<QuotaFeature, number>;
};

type AccountInput = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    plan?: string;
    subscriptionStatus?: string;
    accessOverride?: string | null;
};

type CounterInput = {
    userID: string;
    feature: string;
    period: string;
    count: number;
};

function emptyTotals(): Record<QuotaFeature, number> {
    return {
        search: 0,
        discover: 0,
        chat: 0,
        scholar_search: 0,
        projects: 0,
    };
}

export function buildAccountQuota(input: {
    users: AccountInput[];
    counters: CounterInput[];
    entitlements: Record<Plan, Record<QuotaFeature, number>>;
    now: Date;
}): AccountQuotaRow[] {
    const counts = new Map<string, number>();
    for (const counter of input.counters) {
        counts.set(
            `${counter.userID}:${counter.feature}:${counter.period}`,
            counter.count,
        );
    }

    return input.users
        .map((user) => {
            const plan = resolvePlan({
                plan: user.plan,
                subscriptionStatus: user.subscriptionStatus,
                accessOverride: user.accessOverride ?? undefined,
            });
            const features = QUOTA_FEATURES.map((feature) => {
                const period = quotaPeriod(plan, feature, input.now);
                return {
                    feature,
                    used:
                        counts.get(`${user.id}:${feature}:${period}`) ?? 0,
                    limit: input.entitlements[plan][feature],
                    period,
                };
            });
            const name = [user.firstName, user.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
            return {
                id: user.id,
                name: name || user.email || "Account",
                email: user.email || "",
                plan,
                features,
            };
        })
        .sort((left, right) => {
            const used = (row: AccountQuotaRow) =>
                row.features.reduce((total, cell) => total + cell.used, 0);
            return used(right) - used(left) || left.email.localeCompare(right.email);
        });
}

export function buildMonthlyQuota(
    rows: Array<{ period: string; feature: string; used: number }>,
    now: Date,
    months = 6,
): MonthlyQuotaRow[] {
    const byPeriod = new Map<string, Record<QuotaFeature, number>>();
    for (let offset = 0; offset < months; offset += 1) {
        const period = monthKey(
            new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
            ),
        );
        byPeriod.set(period, emptyTotals());
    }

    for (const row of rows) {
        if (!byPeriod.has(row.period)) continue;
        if (!QUOTA_FEATURES.includes(row.feature as QuotaFeature)) continue;
        const totals = byPeriod.get(row.period)!;
        totals[row.feature as QuotaFeature] += row.used;
    }

    return [...byPeriod.entries()].map(([period, totals]) => ({
        period,
        totals,
    }));
}
