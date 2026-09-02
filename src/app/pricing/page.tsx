"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useSession } from "../lib/use-session";
import styles from "./pricing.module.scss";

type PricingConfig = {
    prices: Record<"month" | "year", { amount: number; currency: string }>;
    entitlements: Record<
        "guest" | "free" | "pro",
        Record<"search" | "discover" | "chat" | "scholar_search" | "projects", number>
    >;
};

const defaults: PricingConfig = {
    prices: {
        month: { amount: 1200, currency: "usd" },
        year: { amount: 9900, currency: "usd" },
    },
    entitlements: {
        guest: { search: 3, discover: 1, chat: 0, scholar_search: 0, projects: 0 },
        free: { search: 20, discover: 2, chat: 5, scholar_search: 0, projects: 3 },
        pro: { search: 300, discover: 40, chat: 100, scholar_search: 25, projects: 50 },
    },
};

function money(amount: number, currency: string, digits = 0) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: digits,
    }).format(amount / 100);
}

function PricingContent() {
    const searchParams = useSearchParams();
    const { isLoggedIn, user, quotas, loading } = useSession();
    const [busy, setBusy] = useState<"month" | "year" | "portal" | null>(null);
    const [error, setError] = useState("");
    const [pricing, setPricing] = useState<PricingConfig>(defaults);
    const checkoutState = searchParams.get("checkout");
    const monthlyIntent = searchParams.get("intent") === "monthly";

    useEffect(() => {
        fetch("/api/pricing")
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then(setPricing)
            .catch(() => undefined);
    }, []);

    const openBilling = async (
        endpoint: "checkout" | "portal",
        interval?: "month" | "year",
    ) => {
        setBusy(endpoint === "portal" ? "portal" : interval || "month");
        setError("");
        try {
            posthog.capture(
                endpoint === "portal"
                    ? "billing_portal_opened"
                    : "checkout_started",
                interval ? { interval } : undefined,
            );
            const response = await fetch(`/api/billing/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body:
                    endpoint === "checkout"
                        ? JSON.stringify({ interval })
                        : undefined,
            });
            const data = await response.json();
            if (!response.ok || !data.url) {
                throw new Error(data.error || "Billing is unavailable.");
            }
            window.location.assign(data.url);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Billing is unavailable.",
            );
            setBusy(null);
        }
    };

    return (
        <main className={styles.page} data-page-scroll>
            <header className={styles.hero}>
                <p className={styles.eyebrow}>Simple research pricing</p>
                <h1>Search freely. Pay for deeper synthesis.</h1>
                <p>
                    Start with literature search and two Discovery runs. Upgrade
                    when Expansive Mind becomes part of your research workflow.
                </p>
            </header>

            {checkoutState === "success" && (
                <p className={styles.success}>
                    Payment received. Your Pro access will appear as soon as
                    Stripe confirms the subscription.
                </p>
            )}
            {checkoutState === "canceled" && (
                <p className={styles.notice}>Checkout canceled. No charge was made.</p>
            )}
            {error && <p className={styles.error}>{error}</p>}
            {monthlyIntent && !loading && user?.plan !== "pro" && (
                <section className={styles.upgradeIntent}>
                    <div>
                        <p className={styles.planLabel}>Your account is ready</p>
                        <h2>Continue with Researcher Pro</h2>
                        <p>
                            Unlock {pricing.entitlements.pro.discover} Discovery
                            syntheses and {pricing.entitlements.pro.chat} AI paper
                            questions every month.
                        </p>
                    </div>
                    {isLoggedIn ? (
                        <button
                            className={styles.primaryButton}
                            disabled={Boolean(busy)}
                            onClick={() => openBilling("checkout", "month")}
                        >
                            {busy === "month"
                                ? "Opening Stripe…"
                                : `Continue — ${money(
                                      pricing.prices.month.amount,
                                      pricing.prices.month.currency,
                                  )}/month`}
                        </button>
                    ) : (
                        <Link
                            className={styles.primaryButton}
                            href="/signup?next=%2Fpricing%3Fintent%3Dmonthly"
                        >
                            Create account to continue
                        </Link>
                    )}
                </section>
            )}

            <section className={styles.plans} aria-label="Pricing plans">
                <article className={styles.plan}>
                    <div>
                        <p className={styles.planLabel}>Free</p>
                        <h2>$0</h2>
                        <p>Explore the product before paying.</p>
                    </div>
                    <ul>
                        <li>{pricing.entitlements.free.search} paper searches each month</li>
                        <li>{pricing.entitlements.free.discover} lifetime Discovery syntheses</li>
                        <li>{pricing.entitlements.free.chat} AI paper questions each month</li>
                        <li>{pricing.entitlements.free.projects} research projects</li>
                        <li>Save up to 10 papers</li>
                    </ul>
                    {!isLoggedIn && !loading && (
                        <Link className={styles.secondaryButton} href="/signup">
                            Create free account
                        </Link>
                    )}
                </article>

                <article className={`${styles.plan} ${styles.featured}`}>
                    <div>
                        <p className={styles.planLabel}>Researcher Pro</p>
                        <h2>
                            {money(
                                pricing.prices.month.amount,
                                pricing.prices.month.currency,
                            )}{" "}
                            <span>/ month</span>
                        </h2>
                        <p>For individual researchers using AI every week.</p>
                    </div>
                    <ul>
                        <li>{pricing.entitlements.pro.search} paper searches each month</li>
                        <li>{pricing.entitlements.pro.discover} Discovery syntheses each month</li>
                        <li>{pricing.entitlements.pro.chat} AI paper questions each month</li>
                        <li>{pricing.entitlements.pro.scholar_search} explicit Scholar searches each month</li>
                        <li>{pricing.entitlements.pro.projects} research projects each month</li>
                    </ul>
                    {user?.plan === "pro" ? (
                        <button
                            className={styles.primaryButton}
                            disabled={Boolean(busy)}
                            onClick={() => openBilling("portal")}
                        >
                            {busy === "portal" ? "Opening…" : "Manage billing"}
                        </button>
                    ) : isLoggedIn ? (
                        <div className={styles.actions}>
                            <button
                                className={styles.primaryButton}
                                disabled={Boolean(busy)}
                                onClick={() => openBilling("checkout", "month")}
                            >
                                {busy === "month"
                                    ? "Opening…"
                                    : "Choose monthly"}
                            </button>
                            <button
                                className={styles.secondaryButton}
                                disabled={Boolean(busy)}
                                onClick={() => openBilling("checkout", "year")}
                            >
                                {busy === "year"
                                    ? "Opening…"
                                    : `${money(
                                          pricing.prices.year.amount,
                                          pricing.prices.year.currency,
                                      )} yearly`}
                            </button>
                        </div>
                    ) : (
                        <Link
                            className={styles.primaryButton}
                            href="/signup?next=/pricing"
                        >
                            Sign up to upgrade
                        </Link>
                    )}
                </article>
            </section>

            {user && quotas && (
                <section className={styles.usage}>
                    <div>
                        <p className={styles.planLabel}>Your account</p>
                        <h2>{user.plan === "pro" ? "Researcher Pro" : "Free"}</h2>
                        <p>{user.email}</p>
                    </div>
                    <div className={styles.usageGrid}>
                        {(
                            [
                                ["search", "Searches"],
                                ["discover", "Discovery"],
                                ["chat", "AI questions"],
                                ["scholar_search", "Scholar"],
                                ["projects", "Projects"],
                            ] as const
                        ).map(([key, label]) => (
                            <div key={key}>
                                <strong>
                                    {quotas[key].unlimited
                                        ? "∞"
                                        : quotas[key].remaining}
                                </strong>
                                <span>{label} remaining</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <p className={styles.finePrint}>
                Usage resets monthly except the Free Discovery trial and Free
                project allowance. AI output can be inaccurate and is not medical
                advice.
            </p>
        </main>
    );
}

export default function PricingPage() {
    return (
        <Suspense fallback={<main className={styles.page} data-page-scroll>Loading pricing…</main>}>
            <PricingContent />
        </Suspense>
    );
}
