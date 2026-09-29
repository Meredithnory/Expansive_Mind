"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../../lib/use-session";
import { adminApi as api } from "../../admin-api";
import styles from "../../admin.module.scss";

type Feature = "search" | "discover" | "chat" | "scholar_search" | "projects";
type Plan = "guest" | "free" | "pro";
type Pricing = {
    prices: Record<"month" | "year", { amount: number; currency: string; stripePriceId: string }>;
    entitlements: Record<Plan, Record<Feature, number>>;
    stripeConfigured?: boolean;
    warning?: string;
};

const features: Feature[] = ["search", "discover", "chat", "scholar_search", "projects"];
const plans: Plan[] = ["guest", "free", "pro"];

export default function AdminBillingPage() {
    const { user, loading: sessionLoading } = useSession();
    const [pricing, setPricing] = useState<Pricing | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!user?.isAdmin) return;
        setError("");
        try {
            setPricing(await api<Pricing>("/api/admin/pricing"));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load pricing.");
        }
    }, [user?.isAdmin]);

    useEffect(() => {
        load();
    }, [load]);

    const savePricing = async () => {
        if (!pricing) return;
        setBusy(true);
        setError("");
        try {
            const updated = await api<Pricing>("/api/admin/pricing", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pricing),
            });
            setPricing(updated);
            setMessage(updated.warning || "Pricing and limits were saved.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save pricing.");
        } finally {
            setBusy(false);
        }
    };

    if (sessionLoading) return <main className={styles.page}>Checking access…</main>;
    if (!user?.isAdmin) {
        return <main className={styles.page}>You are not authorized to view this page.</main>;
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Billing &amp; pricing</h1>
                </div>
            </header>
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.success}>{message}</p>}
            {!pricing && !error ? <p className={styles.muted}>Loading pricing…</p> : null}
            {pricing && (
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
                    <button className={styles.button} disabled={busy} onClick={savePricing}>
                        {busy ? "Saving…" : "Save pricing and limits"}
                    </button>
                </section>
            )}

        </main>
    );
}
