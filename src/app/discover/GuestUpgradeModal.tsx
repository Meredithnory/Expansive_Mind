"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import styles from "./guest-upgrade-modal.module.scss";

type PricingConfig = {
    prices: {
        month: { amount: number; currency: string };
    };
    entitlements: {
        free: { discover: number; chat: number; search: number };
        pro: {
            discover: number;
            chat: number;
            search: number;
            scholar_search: number;
        };
    };
};

const DEFAULT_PRICING: PricingConfig = {
    prices: { month: { amount: 1200, currency: "usd" } },
    entitlements: {
        free: { discover: 2, chat: 5, search: 20 },
        pro: { discover: 40, chat: 100, search: 300, scholar_search: 25 },
    },
};

function monthlyPrice(amount: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(amount / 100);
}

export default function GuestUpgradeModal({
    open,
    exhausted,
    canContinueReading = false,
    onClose,
}: {
    open: boolean;
    exhausted: boolean;
    canContinueReading?: boolean;
    onClose: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [pricing, setPricing] = useState(DEFAULT_PRICING);

    useEffect(() => {
        fetch("/api/pricing")
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then(setPricing)
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
            posthog.capture("guest_discovery_upgrade_viewed", {
                reason: exhausted ? "quota_exhausted" : "guest_intro",
            });
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [exhausted, open]);

    const signupHref = `/signup?next=${encodeURIComponent(
        "/pricing?intent=monthly",
    )}`;
    const price = monthlyPrice(
        pricing.prices.month.amount,
        pricing.prices.month.currency,
    );

    return (
        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-labelledby="guest-upgrade-title"
            onClose={onClose}
            onCancel={onClose}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className={styles.sheet}>
                <div className={styles.dragHandle} aria-hidden="true" />
                <button
                    type="button"
                    className={styles.close}
                    aria-label="Close upgrade options"
                    onClick={onClose}
                >
                    ×
                </button>

                <p className={styles.eyebrow}>
                    {exhausted ? "Your preview is complete" : "One free preview"}
                </p>
                <h2 id="guest-upgrade-title">
                    {exhausted
                        ? "Keep your research momentum"
                        : "Try Discovery, then go deeper with Pro"}
                </h2>
                <p className={styles.summary}>
                    {exhausted
                        ? canContinueReading
                            ? "You can keep reading this brief. Researcher Pro unlocks more syntheses and paper conversations all month."
                            : "You used your guest Discovery synthesis. Researcher Pro keeps evidence briefs and paper conversations available all month."
                        : "Your guest preview includes one cited synthesis. Upgrade when you are ready to make Discovery part of your workflow."}
                </p>

                <div className={styles.offer}>
                    <div>
                        <span>Researcher Pro</span>
                        <strong>
                            {price}
                            <small>/month</small>
                        </strong>
                    </div>
                    <span className={styles.badge}>Built for weekly research</span>
                </div>

                <ul className={styles.benefits}>
                    <li>
                        <strong>{pricing.entitlements.pro.discover}</strong>{" "}
                        Discovery syntheses every month
                    </li>
                    <li>
                        <strong>{pricing.entitlements.pro.chat}</strong> AI paper
                        questions every month
                    </li>
                    <li>
                        <strong>{pricing.entitlements.pro.search}</strong> paper
                        searches plus Scholar access
                    </li>
                </ul>

                <Link
                    href={signupHref}
                    className={styles.primaryAction}
                    onClick={() =>
                        posthog.capture("guest_discovery_upgrade_clicked", {
                            interval: "month",
                            reason: exhausted ? "quota_exhausted" : "guest_intro",
                        })
                    }
                >
                    Unlock Pro for {price}/month
                    <span aria-hidden="true">→</span>
                </Link>

                {canContinueReading || !exhausted ? (
                    <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={onClose}
                    >
                        {exhausted
                            ? "Keep reading this brief"
                            : "Use my free preview first"}
                    </button>
                ) : (
                    <Link
                        href="/searchpaper"
                        className={styles.secondaryAction}
                        onClick={onClose}
                    >
                        Continue with basic paper search
                    </Link>
                )}

                <p className={styles.freeNote}>
                    Prefer to start free? Creating an account includes{" "}
                    {pricing.entitlements.free.discover} lifetime Discovery runs
                    and {pricing.entitlements.free.chat} AI paper questions per
                    month.
                </p>
            </div>
        </dialog>
    );
}
