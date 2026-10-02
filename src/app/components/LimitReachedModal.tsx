"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { useSession } from "../lib/use-session";
import { LIMIT_REACHED_EVENT, type LimitReached } from "../lib/limit-reached";
import { countOf, limitRenewsOn } from "../lib/plan-messages";
import { DEVELOPER_NAME } from "../lib/contact";
import styles from "../discover/guest-upgrade-modal.module.scss";
import own from "./styles/limit-modal.module.scss";

const NOUN: Record<LimitReached["feature"], string> = {
    discover: "discoveries",
    search: "paper searches",
    chat: "paper assistant questions",
};

type Status = "idle" | "sending" | "sent" | "already" | "failed";

/**
 * Shown the moment a signed-in person is stopped by a used-up monthly
 * allowance: what ran out, when it comes back, and a way to ask Meredith
 * for more.
 */
export default function LimitReachedModal() {
    const { isLoggedIn, user } = useSession();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState<LimitReached | null>(null);
    const [note, setNote] = useState("");
    const [status, setStatus] = useState<Status>("idle");

    useEffect(() => {
        const onLimit = (event: Event) => {
            const detail = (event as CustomEvent<LimitReached>).detail;
            if (!detail || !isLoggedIn) return;
            setNote("");
            setStatus("idle");
            setOpen(detail);
            posthog.capture("limit_reached_shown", { feature: detail.feature });
        };
        window.addEventListener(LIMIT_REACHED_EVENT, onLimit);
        return () => window.removeEventListener(LIMIT_REACHED_EVENT, onLimit);
    }, [isLoggedIn]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    const close = () => setOpen(null);
    const builder = DEVELOPER_NAME.split(" ")[0];
    const month = new Date().toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

    const ask = async () => {
        if (!open) return;
        setStatus("sending");
        try {
            const response = await fetch("/api/limits/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ feature: open.feature, note }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error();
            setStatus(data.already ? "already" : "sent");
            posthog.capture("limit_more_requested", { feature: open.feature });
        } catch {
            setStatus("failed");
        }
    };

    const what = open
        ? open.limit
            ? countOf(open.feature, open.limit)
            : NOUN[open.feature]
        : "";
    const done = status === "sent" || status === "already";

    return (
        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-labelledby="limit-reached-title"
            onClose={close}
            onCancel={close}
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            {open ? (
                <div className={styles.sheet}>
                    <div className={styles.dragHandle} aria-hidden="true" />
                    <button type="button" className={styles.close} aria-label="Close" onClick={close}>
                        ×
                    </button>
                    <p className={styles.eyebrow}>{done ? "Request sent" : "Monthly limit"}</p>
                    <h2 id="limit-reached-title">
                        {done ? `${builder} has your request` : `You've used your ${what} for ${month}`}
                    </h2>
                    {done ? (
                        <p className={styles.summary}>
                            {status === "already"
                                ? `You already asked this month, so ${builder} has it. She'll reply to ${user?.email ?? "your email"}.`
                                : `She reads every request and will reply to ${user?.email ?? "your email"}. Your allowance also starts over on ${limitRenewsOn()}.`}
                        </p>
                    ) : (
                        <>
                            <p className={styles.summary}>
                                You get more on {limitRenewsOn()}. If you need more before then, ask here and{" "}
                                {builder}, who builds Expansive Mind, will read it.
                            </p>
                            <label className={own.noteLabel} htmlFor="limit-request-note">
                                What are you working on? <span>(optional)</span>
                            </label>
                            <textarea
                                id="limit-request-note"
                                className={own.note}
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                maxLength={600}
                                rows={3}
                                placeholder="A grant, a review, a lab project…"
                            />
                            {status === "failed" ? (
                                <p className={own.error} role="alert">
                                    That didn&apos;t send. Try again, or write in from the{" "}
                                    <Link href="/contact" onClick={close}>
                                        Contact page
                                    </Link>
                                    .
                                </p>
                            ) : null}
                        </>
                    )}
                    {done ? (
                        <button type="button" className={styles.primaryAction} onClick={close}>
                            Close
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className={styles.primaryAction}
                                disabled={status === "sending"}
                                onClick={() => void ask()}
                            >
                                {status === "sending" ? "Sending…" : "Ask for more"}
                            </button>
                            <button type="button" className={styles.secondaryAction} onClick={close}>
                                Not now
                            </button>
                        </>
                    )}
                </div>
            ) : null}
        </dialog>
    );
}
