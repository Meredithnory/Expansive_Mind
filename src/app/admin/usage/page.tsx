"use client";

import { useEffect, useState } from "react";
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

type UsageSummary = {
    rangeDays: number;
    estimatedCostUsd: number;
    monthlyListPrice: number;
    users: Record<string, number>;
    guests?: GuestNetworkUsage[];
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
                                            ? "Blocked until they pay"
                                            : "Preview remaining"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </main>
    );
}
