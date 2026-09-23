"use client";

import { useEffect, useState } from "react";
import {
    formatQuotaPeriod,
    QUOTA_FEATURES,
    QUOTA_LABELS,
} from "../../lib/quota-period";
import styles from "./usage.module.scss";

type GuestNetworkUsage = {
    fingerprint: string;
    discoverUsed: number;
    discoverLimit: number;
    chatUsed: number;
    chatLimit: number;
    searchUsed: number;
    searchLimit: number;
    lastSeen: string;
    exhausted: boolean;
};

type GuestDiscoveryRow = {
    id: string;
    fingerprint: string;
    question: string;
    briefPreview: string;
    paperTitles: string[];
    papersUsed: number;
    correctedQuery: string | null;
    createdAt: string | null;
};

type QuotaCell = {
    feature: (typeof QUOTA_FEATURES)[number];
    used: number;
    limit: number;
    period: string;
};

type AccountQuotaRow = {
    id: string;
    name: string;
    email: string;
    plan: string;
    features: QuotaCell[];
};

type MonthlyQuotaRow = {
    period: string;
    totals: Record<(typeof QUOTA_FEATURES)[number], number>;
};

type UsageSummary = {
    rangeDays: number;
    estimatedCostUsd: number;
    monthlyListPrice: number;
    users: Record<string, number>;
    guests?: GuestNetworkUsage[];
    guestDiscoveries?: GuestDiscoveryRow[];
    quota?: {
        month: string;
        months: MonthlyQuotaRow[];
        accounts: AccountQuotaRow[];
    };
    usage: Array<{
        feature: string;
        provider: string;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
        failures: number;
    }>;
};

export default function AdminUsagePage() {
    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/admin/usage", { cache: "no-store" })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setSummary(data);
            })
            .catch((err) =>
                setError(err instanceof Error ? err.message : "Unable to load."),
            );
    }, []);

    if (error) return <main className={styles.page}>{error}</main>;
    if (!summary) return <main className={styles.page}>Loading usage…</main>;

    const proUsers = summary.users.pro || 0;
    const monthlyRevenue = proUsers * summary.monthlyListPrice;
    const contribution = monthlyRevenue - summary.estimatedCostUsd;
    const quota = summary.quota;
    const currentMonth = quota?.months[0];

    return (
        <main className={styles.page}>
            <header>
                <p>Internal · last {summary.rangeDays} days</p>
                <h1>Usage and contribution margin</h1>
            </header>
            <section className={styles.metrics}>
                <div>
                    <strong>${summary.estimatedCostUsd.toFixed(2)}</strong>
                    <span>Metered AI cost</span>
                </div>
                <div>
                    <strong>{proUsers}</strong>
                    <span>Pro accounts</span>
                </div>
                <div>
                    <strong>${monthlyRevenue.toFixed(2)}</strong>
                    <span>Monthly list revenue</span>
                </div>
                <div>
                    <strong>${contribution.toFixed(2)}</strong>
                    <span>Before fixed costs and Stripe</span>
                </div>
            </section>

            {quota ? (
                <section className={styles.quota}>
                    <h2>Account allowances</h2>
                    <p>
                        Live counters from each signed-in account. Monthly
                        features reset on the UTC month; Free Discovery and
                        projects stay lifetime.
                    </p>
                    {currentMonth ? (
                        <div className={styles.monthTotals}>
                            {QUOTA_FEATURES.map((feature) => (
                                <div key={feature}>
                                    <strong>
                                        {currentMonth.totals[feature].toLocaleString()}
                                    </strong>
                                    <span>
                                        {QUOTA_LABELS[feature]} ·{" "}
                                        {formatQuotaPeriod(currentMonth.period)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {quota.accounts.length === 0 ? (
                        <p className={styles.emptyGuests}>
                            No signed-in account usage yet.
                        </p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Plan</th>
                                    {QUOTA_FEATURES.map((feature) => (
                                        <th key={feature}>
                                            {QUOTA_LABELS[feature]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {quota.accounts.map((account) => (
                                    <tr key={account.id}>
                                        <td>
                                            <strong>{account.name}</strong>
                                            <small>{account.email}</small>
                                        </td>
                                        <td>{account.plan}</td>
                                        {account.features.map((cell) => (
                                            <td key={cell.feature}>
                                                <span>
                                                    {cell.used}/{cell.limit}
                                                </span>
                                                <small>
                                                    {formatQuotaPeriod(
                                                        cell.period,
                                                    )}
                                                </small>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {quota.months.length > 1 ? (
                        <div className={styles.history}>
                            <h3>Monthly totals</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        {QUOTA_FEATURES.map((feature) => (
                                            <th key={feature}>
                                                {QUOTA_LABELS[feature]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {quota.months.map((row) => (
                                        <tr key={row.period}>
                                            <td>
                                                {formatQuotaPeriod(row.period)}
                                            </td>
                                            {QUOTA_FEATURES.map((feature) => (
                                                <td key={feature}>
                                                    {row.totals[
                                                        feature
                                                    ].toLocaleString()}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </section>
            ) : null}

            <section className={styles.rows}>
                {summary.usage.map((row) => (
                    <article key={`${row.feature}-${row.provider}`}>
                        <div>
                            <h2>{row.feature}</h2>
                            <p>{row.provider}</p>
                        </div>
                        <dl>
                            <div>
                                <dt>Calls</dt>
                                <dd>{row.calls}</dd>
                            </div>
                            <div>
                                <dt>Tokens</dt>
                                <dd>
                                    {(
                                        row.inputTokens + row.outputTokens
                                    ).toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt>Cost</dt>
                                <dd>${row.estimatedCostUsd.toFixed(4)}</dd>
                            </div>
                            <div>
                                <dt>Failures</dt>
                                <dd>{row.failures}</dd>
                            </div>
                        </dl>
                    </article>
                ))}
            </section>
            <section className={styles.guests}>
                <h2>Guest networks</h2>
                <p>
                    Discovery and AI questions are counted per IP. Clearing
                    cookies does not reset the preview. Basic paper search can
                    remain available after Discovery is exhausted.
                </p>
                {(summary.guests ?? []).length === 0 ? (
                    <p className={styles.emptyGuests}>
                        No guest IP usage recorded yet.
                    </p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Network</th>
                                <th>Discovery</th>
                                <th>AI questions</th>
                                <th>Searches</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(summary.guests ?? []).map((guest) => (
                                <tr key={guest.fingerprint}>
                                    <td>
                                        <code>{guest.fingerprint}</code>
                                        {guest.lastSeen ? (
                                            <small>
                                                {new Date(
                                                    guest.lastSeen,
                                                ).toLocaleString()}
                                            </small>
                                        ) : null}
                                    </td>
                                    <td>
                                        {guest.discoverUsed}/
                                        {guest.discoverLimit}
                                    </td>
                                    <td>
                                        {guest.chatUsed}/{guest.chatLimit}
                                    </td>
                                    <td>
                                        {guest.searchUsed}/{guest.searchLimit}
                                    </td>
                                    <td>
                                        {guest.exhausted
                                            ? "Monthly plan needed"
                                            : "Preview remaining"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
            <section className={styles.guests}>
                <h2>Guest Discovery conversations</h2>
                <p>
                    Unsigned Discovery questions and brief previews, kept for
                    90 days so you can see how people use the product before
                    they sign up. Networks are hashed — raw IPs are not stored.
                </p>
                {(summary.guestDiscoveries ?? []).length === 0 ? (
                    <p className={styles.emptyGuests}>
                        No guest Discovery conversations recorded yet.
                    </p>
                ) : (
                    <ul className={styles.guestConversations}>
                        {(summary.guestDiscoveries ?? []).map((row) => (
                            <li key={row.id}>
                                <div>
                                    <strong>{row.question}</strong>
                                    {row.correctedQuery ? (
                                        <small>
                                            Corrected from “{row.correctedQuery}”
                                        </small>
                                    ) : null}
                                    <p>{row.briefPreview}</p>
                                </div>
                                <aside>
                                    <code>{row.fingerprint}</code>
                                    <span>
                                        {row.papersUsed} paper
                                        {row.papersUsed === 1 ? "" : "s"}
                                    </span>
                                    {row.createdAt ? (
                                        <span>
                                            {new Date(
                                                row.createdAt,
                                            ).toLocaleString()}
                                        </span>
                                    ) : null}
                                </aside>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
