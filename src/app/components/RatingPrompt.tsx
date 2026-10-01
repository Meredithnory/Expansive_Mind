"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import {
    RATING_ASK_EVENT,
    RATING_DELAY_MS,
    RATING_STORAGE_KEY,
    shouldAskForRating,
    type RatingAsk,
    type RatingScore,
} from "../lib/rating";
import { sendProductSignal } from "../lib/product-signals";
import styles from "./styles/rating-prompt.module.scss";

const SCORES: Array<{ score: RatingScore; label: string }> = [
    { score: "bad", label: "Bad" },
    { score: "fine", label: "Fine" },
    { score: "good", label: "Good" },
];

const FOLLOW_UP: Record<RatingScore, string> = {
    bad: "What went wrong?",
    fine: "What would make it better?",
    good: "What worked well?",
};

function readAskedAt() {
    try {
        return Number(window.localStorage.getItem(RATING_STORAGE_KEY)) || null;
    } catch {
        return null;
    }
}

function writeAskedAt() {
    try {
        window.localStorage.setItem(RATING_STORAGE_KEY, String(Date.now()));
    } catch {
        // Private mode: the prompt may come back sooner. That's fine.
    }
}

async function postRating(body: Record<string, unknown>) {
    const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return response.ok && typeof data.id === "string" ? (data.id as string) : null;
}

/**
 * "How is Expansive Mind doing?" Bad / Fine / Good, then an optional comment.
 * Pages ask through askForRating; this shows it a little later, at most once
 * every few days per browser, and never blocks the page.
 */
export default function RatingPrompt() {
    const pathname = usePathname();
    const [pending, setPending] = useState<RatingAsk | null>(null);
    const [open, setOpen] = useState<RatingAsk | null>(null);
    const [score, setScore] = useState<RatingScore | null>(null);
    const [ratingId, setRatingId] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [sending, setSending] = useState(false);
    const [thanked, setThanked] = useState(false);
    const [failed, setFailed] = useState(false);
    const savingRef = useRef<Promise<string | null> | null>(null);
    const commentRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const onAsk = (event: Event) => {
            const ask = (event as CustomEvent<RatingAsk>).detail;
            if (!ask || !shouldAskForRating(readAskedAt())) return;
            setPending(ask);
        };
        window.addEventListener(RATING_ASK_EVENT, onAsk);
        return () => window.removeEventListener(RATING_ASK_EVENT, onAsk);
    }, []);

    // Leaving the page before the prompt shows drops it.
    useEffect(() => setPending(null), [pathname]);

    useEffect(() => {
        if (!pending || open) return;
        const timer = window.setTimeout(() => {
            if (document.visibilityState !== "visible" || !shouldAskForRating(readAskedAt())) {
                setPending(null);
                return;
            }
            writeAskedAt();
            setScore(null);
            setRatingId(null);
            setComment("");
            setThanked(false);
            setFailed(false);
            setOpen(pending);
            setPending(null);
            sendProductSignal("rating_prompt_shown");
        }, RATING_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [pending, open]);

    // A keyboard or mouse gets the cursor in the comment box; a phone keeps
    // its keyboard down until someone taps in.
    useEffect(() => {
        if (score && window.matchMedia("(pointer: fine)").matches) commentRef.current?.focus();
    }, [score]);

    useEffect(() => {
        if (!thanked) return;
        const timer = window.setTimeout(() => setOpen(null), 2_400);
        return () => window.clearTimeout(timer);
    }, [thanked]);

    if (!open) return null;

    const close = () => setOpen(null);

    const pick = async (value: RatingScore) => {
        setScore(value);
        posthog.capture("rating_submitted", { score: value, surface: open.surface });
        const saving = postRating({ score: value, surface: open.surface, context: open.context });
        savingRef.current = saving;
        setRatingId(await saving);
    };

    const send = async () => {
        if (!score || !comment.trim()) return;
        setSending(true);
        setFailed(false);
        // If the score didn't save, send it again with the comment.
        const id = ratingId ?? (await savingRef.current);
        const saved = id
            ? await postRating({ id, comment })
            : await postRating({ score, surface: open.surface, context: open.context, comment });
        setSending(false);
        if (saved) setThanked(true);
        else setFailed(true);
    };

    return (
        <section
            className={styles.prompt}
            role="dialog"
            aria-modal="false"
            aria-labelledby="rating-prompt-title"
            onKeyDown={(event) => {
                if (event.key === "Escape") close();
            }}
        >
            <div className={styles.head}>
                <h2 id="rating-prompt-title" className={styles.title}>
                    {thanked
                        ? "Thanks for the feedback."
                        : score
                          ? `Thanks. ${FOLLOW_UP[score]}`
                          : "How is Expansive Mind doing?"}
                    {!score && !thanked ? <span className={styles.optional}> (optional)</span> : null}
                </h2>
                <button type="button" className={styles.close} aria-label="Dismiss" onClick={close}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            {!score ? (
                <div className={styles.scores} role="group" aria-label="Rating">
                    {SCORES.map((item) => (
                        <button
                            key={item.score}
                            type="button"
                            className={styles.score}
                            data-score={item.score}
                            onClick={() => void pick(item.score)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : !thanked ? (
                <form
                    className={styles.follow}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void send();
                    }}
                >
                    <label htmlFor="rating-prompt-comment" className={styles.srOnly}>
                        {FOLLOW_UP[score]}
                    </label>
                    <textarea
                        ref={commentRef}
                        id="rating-prompt-comment"
                        className={styles.comment}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        maxLength={1_000}
                        rows={3}
                        placeholder="Optional"
                    />
                    {failed ? <p className={styles.error}>That didn&apos;t send. Try again?</p> : null}
                    <div className={styles.actions}>
                        <button type="button" className={styles.skip} onClick={close}>
                            Done
                        </button>
                        <button type="submit" className={styles.send} disabled={sending || !comment.trim()}>
                            {sending ? "Sending…" : "Send"}
                        </button>
                    </div>
                </form>
            ) : null}
        </section>
    );
}
