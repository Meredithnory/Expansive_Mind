"use client";

import {
    featureLabel,
    formatCompact,
    formatUsd,
    percentChange,
    providerLabel,
    shareOf,
    successRate,
    type DailyPoint,
    type PriorUsage,
    type UsageRow,
} from "../lib/admin-overview";
import {
    AccountMix,
    FeatureStack,
    MixChart,
    TrendChart,
} from "./OverviewCharts";
import styles from "./admin.module.scss";

export type OverviewUsage = {
    rangeDays: number;
    estimatedCostUsd: number;
    monthlyListPrice: number;
    users: Record<string, number>;
    guests?: unknown[];
    daily?: DailyPoint[];
    prior?: PriorUsage;
    usage: UsageRow[];
};

function Delta({
    current,
    prior,
    invert = false,
}: {
    current: number;
    prior?: number;
    invert?: boolean;
}) {
    if (prior == null) return null;
    const change = percentChange(current, prior);
    if (change == null) return <small className={styles.deltaMuted}>No prior period</small>;
    if (change === 0) return <small className={styles.deltaMuted}>Flat vs prior 30d</small>;
    const up = change > 0;
    const good = invert ? !up : up;
    return (
        <small className={good ? styles.deltaUp : styles.deltaDown}>
            {up ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% vs prior 30d
        </small>
    );
}

export function AdminOverview({ usage }: { usage: OverviewUsage | null }) {
    if (!usage) {
        return (
            <section className={styles.panel}>
                <p className={styles.muted}>Loading operating metrics…</p>
            </section>
        );
    }

    const free = usage.users.free || 0;
    const pro = usage.users.pro || 0;
    const guests = usage.guests?.length || 0;
    const listRevenue = pro * (usage.monthlyListPrice || 0);
    const aiCost = usage.estimatedCostUsd || 0;
    const contribution = listRevenue - aiCost;
    const calls = usage.usage.reduce((sum, row) => sum + row.calls, 0);
    const failures = usage.usage.reduce((sum, row) => sum + row.failures, 0);
    const reliability = successRate(calls, failures);
    const costPerCall = calls ? aiCost / calls : 0;
    const daily = usage.daily ?? [];
    const prior = usage.prior;
    const spendByFeature = usage.usage.reduce<Record<string, number>>(
        (map, row) => {
            map[row.feature] = (map[row.feature] || 0) + row.estimatedCostUsd;
            return map;
        },
        {},
    );
    const featureSpend = Object.entries(spendByFeature)
        .map(([key, value]) => ({
            key,
            label: featureLabel(key),
            value,
        }))
        .sort((left, right) => right.value - left.value);

    return (
        <section className={styles.panel}>
            <div className={styles.overviewHead}>
                <div>
                    <p className={styles.eyebrow}>Operating snapshot</p>
                    <h2>Last {usage.rangeDays} days</h2>
                </div>
                <p>
                    List revenue is current paid seats × list price. AI cost is
                    metered model spend only — before Stripe fees and fixed overhead.
                </p>
            </div>

            <div className={styles.kpiGrid}>
                <article>
                    <span>30-day AI cost</span>
                    <strong>{formatUsd(aiCost)}</strong>
                    <Delta current={aiCost} prior={prior?.estimatedCostUsd} invert />
                </article>
                <article>
                    <span>Monthly list revenue</span>
                    <strong>{formatUsd(listRevenue)}</strong>
                    <small className={styles.deltaMuted}>
                        {pro} paid × {formatUsd(usage.monthlyListPrice || 0)}
                    </small>
                </article>
                <article>
                    <span>List contribution</span>
                    <strong data-tone={contribution >= 0 ? "up" : "down"}>
                        {formatUsd(contribution)}
                    </strong>
                    <small className={styles.deltaMuted}>
                        Before Stripe and fixed costs
                    </small>
                </article>
                <article>
                    <span>Reliability</span>
                    <strong>{(reliability * 100).toFixed(1)}%</strong>
                    <small className={styles.deltaMuted}>
                        {failures.toLocaleString()} failed / {calls.toLocaleString()} calls
                    </small>
                </article>
                <article>
                    <span>Accounts</span>
                    <strong>
                        {pro.toLocaleString()}
                        <em> / {(free + pro).toLocaleString()}</em>
                    </strong>
                    <small className={styles.deltaMuted}>
                        Paid / all registered
                    </small>
                </article>
                <article>
                    <span>Call volume</span>
                    <strong>{formatCompact(calls)}</strong>
                    <Delta current={calls} prior={prior?.calls} />
                    <small className={styles.deltaMuted}>
                        {formatUsd(costPerCall)} blended
                    </small>
                </article>
            </div>

            <div className={styles.chartGrid}>
                <TrendChart daily={daily} />
                <AccountMix free={free} pro={pro} guests={guests} />
                <FeatureStack daily={daily} />
                <MixChart rows={featureSpend} />
            </div>

            <div className={styles.tableWrap}>
                <div className={styles.overviewHead}>
                    <div>
                        <p className={styles.eyebrow}>Product economics</p>
                        <h2>Where spend and risk sit</h2>
                    </div>
                </div>
                {usage.usage.length === 0 ? (
                    <p className={styles.muted}>No usage events in this window.</p>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Provider</th>
                                <th>Calls</th>
                                <th>Cost</th>
                                <th>Share</th>
                                <th>Failures</th>
                                <th>Reliability</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usage.usage.map((row) => (
                                <tr key={`${row.feature}-${row.provider}`}>
                                    <td>
                                        <strong>{featureLabel(row.feature)}</strong>
                                    </td>
                                    <td>{providerLabel(row.provider)}</td>
                                    <td>{formatCompact(row.calls)}</td>
                                    <td>{formatUsd(row.estimatedCostUsd)}</td>
                                    <td>
                                        {(
                                            shareOf(row.estimatedCostUsd, aiCost) *
                                            100
                                        ).toFixed(0)}
                                        %
                                    </td>
                                    <td>{row.failures}</td>
                                    <td>
                                        {(
                                            successRate(row.calls, row.failures) *
                                            100
                                        ).toFixed(1)}
                                        %
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
}
