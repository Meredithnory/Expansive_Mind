"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "../lib/use-session";
import styles from "./admin.module.scss";

type Tab = "overview" | "pricing" | "users" | "audit";
type Feature = "search" | "discover" | "chat" | "scholar_search" | "projects";
type Plan = "guest" | "free" | "pro";
type Pricing = {
    prices: Record<"month" | "year", { amount: number; currency: string; stripePriceId: string }>;
    entitlements: Record<Plan, Record<Feature, number>>;
    stripeConfigured?: boolean;
    warning?: string;
};
type UserRow = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    effectivePlan: string;
    accessOverride?: string | null;
    subscriptionStatus: string;
    stripeSubscriptionId?: string;
    subscriptionCurrentPeriodEnd?: string;
    usage: Record<string, number>;
};
type Usage = {
    rangeDays: number;
    estimatedCostUsd: number;
    monthlyListPrice: number;
    users: Record<string, number>;
    usage: Array<{
        feature: string;
        provider: string;
        calls: number;
        estimatedCostUsd: number;
        failures: number;
    }>;
};
type AuditEntry = {
    _id: string;
    adminEmail: string;
    action: string;
    target: string;
    createdAt: string;
};

const features: Feature[] = ["search", "discover", "chat", "scholar_search", "projects"];
const plans: Plan[] = ["guest", "free", "pro"];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, { cache: "no-store", ...options });
    const text = await response.text();
    let data: { error?: string; message?: string } = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(
                response.ok
                    ? "The server returned an unexpected response."
                    : `Request failed (${response.status}).`,
            );
        }
    }
    if (!response.ok) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status}).`,
        );
    }
    return data as T;
}

export default function AdminPage() {
    const { user, loading: sessionLoading } = useSession();
    const [tab, setTab] = useState<Tab>("overview");
    const [pricing, setPricing] = useState<Pricing | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState("");

    const load = useCallback(async () => {
        if (!user?.isAdmin) return;
        setError("");
        try {
            const [usageData, pricingData, usersData, auditData] = await Promise.all([
                api<Usage>("/api/admin/usage"),
                api<Pricing>("/api/admin/pricing"),
                api<{ users: UserRow[] }>("/api/admin/users"),
                api<{ entries: AuditEntry[] }>("/api/admin/audit"),
            ]);
            setUsage(usageData);
            setPricing(pricingData);
            setUsers(usersData.users);
            setAudit(auditData.entries);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load admin portal.");
        }
    }, [user?.isAdmin]);

    useEffect(() => {
        load();
    }, [load]);

    const searchUsers = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const data = await api<{ users: UserRow[] }>(
                `/api/admin/users?q=${encodeURIComponent(query)}`,
            );
            setUsers(data.users);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed.");
        }
    };

    const savePricing = async () => {
        if (!pricing) return;
        setBusy("pricing");
        setError("");
        try {
            const updated = await api<Pricing>("/api/admin/pricing", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pricing),
            });
            setPricing(updated);
            setMessage(
                updated.warning || "Pricing and limits were saved.",
            );
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save pricing.");
        } finally {
            setBusy("");
        }
    };

    const supportAction = async (
        selectedUser: UserRow,
        action: string,
        feature?: Feature,
    ) => {
        const label = action.replaceAll("_", " ");
        if (!window.confirm(`Confirm ${label} for ${selectedUser.email}?`)) return;
        setBusy(`${selectedUser._id}:${action}`);
        setError("");
        try {
            await api("/api/admin/users/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUser._id,
                    action,
                    confirm: action,
                    feature,
                }),
            });
            setMessage(`${label} completed for ${selectedUser.email}.`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Support action failed.");
        } finally {
            setBusy("");
        }
    };

    if (sessionLoading) return <main className={styles.page}>Checking access…</main>;
    if (!user?.isAdmin) {
        return <main className={styles.page}>You are not authorized to view this page.</main>;
    }

    const proUsers = usage?.users.pro || 0;
    const listRevenue = proUsers * (usage?.monthlyListPrice || 0);

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Internal administration</p>
                    <h1>Billing and support</h1>
                </div>
                <span className={styles.muted}>{user.email}</span>
            </header>
            <nav className={styles.tabs} aria-label="Admin sections" role="tablist">
                {(["overview", "pricing", "users", "audit"] as Tab[]).map((item) => (
                    <button
                        key={item}
                        type="button"
                        role="tab"
                        aria-selected={tab === item}
                        onClick={() => setTab(item)}
                    >
                        {item[0].toUpperCase() + item.slice(1)}
                    </button>
                ))}
            </nav>
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.success}>{message}</p>}

            {tab === "overview" && (
                <section className={styles.panel}>
                    <div className={styles.metrics}>
                        <div><strong>{usage?.users.free || 0}</strong><span>Free accounts</span></div>
                        <div><strong>{proUsers}</strong><span>Paid plan records</span></div>
                        <div><strong>${listRevenue.toFixed(2)}</strong><span>Monthly list value</span></div>
                        <div><strong>${(usage?.estimatedCostUsd || 0).toFixed(2)}</strong><span>30-day AI cost</span></div>
                    </div>
                    <div className={styles.grid}>
                        {usage?.usage.map((row) => (
                            <article className={styles.card} key={`${row.feature}-${row.provider}`}>
                                <strong>{row.calls.toLocaleString()} calls</strong>
                                <p>{row.feature} · {row.provider}</p>
                                <span className={styles.muted}>
                                    ${row.estimatedCostUsd.toFixed(4)} · {row.failures} failures
                                </span>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {tab === "pricing" && pricing && (
                <section className={styles.panel}>
                    <p className={styles.notice}>
                        {pricing.stripeConfigured
                            ? "Price changes create new Stripe Prices for future subscribers. Existing subscribers keep their current price."
                            : "Stripe is not connected yet. You can still save display prices and usage limits. Checkout stays off until STRIPE_SECRET_KEY is set and prices are saved again."}
                    </p>
                    <div className={styles.grid}>
                        {(["month", "year"] as const).map((interval) => (
                            <article className={styles.card} key={interval}>
                                <h2>{interval === "month" ? "Monthly" : "Annual"} price</h2>
                                <label className={styles.field}>
                                    <span>Amount ({pricing.prices[interval].currency.toUpperCase()})</span>
                                    <input
                                        type="number"
                                        min="0.50"
                                        step="0.01"
                                        value={pricing.prices[interval].amount / 100}
                                        onChange={(event) =>
                                            setPricing({
                                                ...pricing,
                                                prices: {
                                                    ...pricing.prices,
                                                    [interval]: {
                                                        ...pricing.prices[interval],
                                                        amount: Math.round(Number(event.target.value) * 100),
                                                    },
                                                },
                                            })
                                        }
                                    />
                                </label>
                                <p className={styles.muted}>
                                    {pricing.prices[interval].stripePriceId ||
                                        (pricing.stripeConfigured
                                            ? "No Stripe Price yet — save to create one."
                                            : "No Stripe Price configured")}
                                </p>
                            </article>
                        ))}
                    </div>
                    <h2>Usage limits</h2>
                    <div className={styles.grid}>
                        {plans.map((plan) => (
                            <article className={styles.card} key={plan}>
                                <h3>{plan[0].toUpperCase() + plan.slice(1)}</h3>
                                {features.map((feature) => (
                                    <label className={styles.field} key={feature}>
                                        <span>{feature.replace("_", " ")}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={pricing.entitlements[plan][feature]}
                                            onChange={(event) =>
                                                setPricing({
                                                    ...pricing,
                                                    entitlements: {
                                                        ...pricing.entitlements,
                                                        [plan]: {
                                                            ...pricing.entitlements[plan],
                                                            [feature]: Number(event.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                        />
                                    </label>
                                ))}
                            </article>
                        ))}
                    </div>
                    <button className={styles.button} disabled={busy === "pricing"} onClick={savePricing}>
                        {busy === "pricing" ? "Saving…" : "Save pricing and limits"}
                    </button>
                </section>
            )}

            {tab === "users" && (
                <section className={styles.panel}>
                    <form className={styles.toolbar} onSubmit={searchUsers}>
                        <input
                            className={styles.search}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search name or email"
                        />
                        <button className={styles.button}>Search</button>
                    </form>
                    <table className={styles.table}>
                        <thead><tr><th>User</th><th>Access</th><th>Usage</th><th>Support actions</th></tr></thead>
                        <tbody>
                            {users.map((selectedUser) => (
                                <tr key={selectedUser._id}>
                                    <td>
                                        <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>
                                        <span className={styles.muted}>{selectedUser.email}</span>
                                    </td>
                                    <td>
                                        {selectedUser.effectivePlan} · {selectedUser.subscriptionStatus}
                                        {selectedUser.accessOverride && <div className={styles.eyebrow}>Complimentary Pro</div>}
                                    </td>
                                    <td className={styles.muted}>
                                        {Object.entries(selectedUser.usage).map(([feature, count]) => (
                                            <div key={feature}>{feature}: {count}</div>
                                        ))}
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button className={styles.button} disabled={Boolean(busy)} onClick={() => supportAction(selectedUser, selectedUser.accessOverride ? "revoke_pro" : "grant_pro")}>
                                                {selectedUser.accessOverride ? "Remove comp" : "Grant Pro"}
                                            </button>
                                            <button className={styles.button} disabled={Boolean(busy)} onClick={() => supportAction(selectedUser, "reset_usage")}>Reset usage</button>
                                            {selectedUser.stripeSubscriptionId && (
                                                <button className={styles.danger} disabled={Boolean(busy)} onClick={() => supportAction(selectedUser, "cancel_subscription")}>Cancel renewal</button>
                                            )}
                                            <button className={styles.danger} disabled={Boolean(busy)} onClick={() => supportAction(selectedUser, "refund_latest")}>Refund latest</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {tab === "audit" && (
                <section className={styles.panel}>
                    <table className={styles.table}>
                        <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead>
                        <tbody>
                            {audit.map((entry) => (
                                <tr key={entry._id}>
                                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                    <td>{entry.adminEmail}</td>
                                    <td>{entry.action}</td>
                                    <td>{entry.target}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </main>
    );
}
