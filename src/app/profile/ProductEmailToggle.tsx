"use client";

import { useState } from "react";
import { useSession } from "../lib/use-session";
import styles from "./profile.module.scss";

/** On/off for product email from the team. Account email is not affected. */
export default function ProductEmailToggle() {
    const { user, refresh } = useSession();
    const [on, setOn] = useState(Boolean(user?.productEmailOptIn));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const toggle = async () => {
        const next = !on;
        setOn(next);
        setSaving(true);
        setError("");
        try {
            const response = await fetch("/api/account/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productEmailOptIn: next }),
            });
            if (!response.ok) throw new Error();
            await refresh();
        } catch {
            setOn(!next);
            setError("That didn't save. Try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.emailToggle}>
            <div className={styles.emailToggleText}>
                <span className={styles.detailLabel} id="product-email-label">
                    Newsletter and product updates
                </span>
                <span id="product-email-help">
                    Unsubscribe anytime. Account email, like password resets, always
                    comes.
                </span>
                {error ? <span className={styles.emailToggleError}>{error}</span> : null}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby="product-email-label"
                aria-describedby="product-email-help"
                className={styles.switch}
                disabled={saving}
                onClick={toggle}
            >
                <span className={styles.switchKnob} aria-hidden="true" />
            </button>
        </div>
    );
}
