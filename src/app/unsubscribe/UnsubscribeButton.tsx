"use client";

import { useState } from "react";
import styles from "./unsubscribe.module.scss";

export default function UnsubscribeButton({ token }: { token: string }) {
    const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
    const unsubscribe = async () => {
        setState("busy");
        try {
            const response = await fetch("/api/email/unsubscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            setState(response.ok ? "done" : "error");
        } catch {
            setState("error");
        }
    };
    if (state === "done") {
        return (
            <p className={styles.done} role="status">
                You&apos;re unsubscribed. You can turn it back on from your profile.
            </p>
        );
    }
    return (
        <>
            <button
                type="button"
                className={styles.button}
                onClick={unsubscribe}
                disabled={state === "busy"}
            >
                {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
            </button>
            {state === "error" ? (
                <p className={styles.error} role="alert">
                    That didn&apos;t go through. Try again.
                </p>
            ) : null}
        </>
    );
}
