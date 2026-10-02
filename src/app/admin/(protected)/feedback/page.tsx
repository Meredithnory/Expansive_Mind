"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { adminApi, postJson } from "../../admin-api";
import {
    RATING_SURFACE_LABEL,
    ratingShares,
    type RatingCounts,
    type RatingScore,
    type RatingSurface,
} from "../../../lib/rating";
import styles from "../../admin-portal.module.scss";

type Message = {
    _id: string;
    name: string;
    email: string;
    topic: string;
    message: string;
    status: "new" | "done";
    emailed: boolean;
    createdAt: string;
};

type Filter = "new" | "done" | "all";

type Ratings = {
    days: number;
    counts: RatingCounts;
    shown: number;
    recent: Array<{
        id: string;
        score: RatingScore;
        surface: RatingSurface;
        context: string;
        comment: string;
        createdAt: string;
        who: string;
        plan: string;
    }>;
};

const SCORE_LABEL: Record<RatingScore, string> = { good: "Good", fine: "Fine", bad: "Bad" };

/** Answers to the in-app "How is Expansive Mind doing?" prompt. */
function RatingsPanel() {
    const [ratings, setRatings] = useState<Ratings | null>(null);
    const [error, setError] = useState("");
    const [show, setShow] = useState<RatingScore | "all">("all");

    useEffect(() => {
        adminApi<Ratings>("/api/admin/ratings")
            .then(setRatings)
            .catch((err) => setError(err instanceof Error ? err.message : "Unable to load ratings."));
    }, []);

    if (error) return <p className={styles.error}>{error}</p>;
    const shares = ratings ? ratingShares(ratings.counts) : null;
    const recent = ratings?.recent.filter((item) => show === "all" || item.score === show) ?? [];

    return (
        <section className={styles.card} aria-labelledby="ratings-h">
            <div className={styles.cardHead}>
                <div>
                    <h2 id="ratings-h">How is Expansive Mind doing?</h2>
                    <p className={styles.muted}>
                        Answers to the pop-up after a discovery or a paper chat answer, last 30 days.
                    </p>
                </div>
                <div role="radiogroup" aria-label="Show ratings" className={clsx(styles.segmented, styles.segmentedSmall)}>
                    {(["all", "bad", "fine", "good"] as const).map((item) => (
                        <button key={item} type="button" role="radio" aria-checked={show === item} onClick={() => setShow(item)}>
                            {item === "all" ? "All" : SCORE_LABEL[item]}
                        </button>
                    ))}
                </div>
            </div>

            <div className={clsx(styles.kpiGrid, styles.ratingKpis)}>
                {(["good", "fine", "bad"] as const).map((score) => (
                    <div key={score} className={styles.kpi}>
                        <span>{SCORE_LABEL[score]}</span>
                        <strong>{ratings ? ratings.counts[score].toLocaleString() : "—"}</strong>
                        <span className={styles.kpiNote}>
                            {shares?.total ? `${shares[score]}% of answers` : "No answers yet"}
                        </span>
                    </div>
                ))}
                <div className={styles.kpi}>
                    <span>Answered</span>
                    <strong>{shares ? shares.total.toLocaleString() : "—"}</strong>
                    <span className={styles.kpiNote}>
                        {ratings?.shown
                            ? `of ${ratings.shown.toLocaleString()} times it was shown`
                            : "Not shown to anyone yet"}
                    </span>
                </div>
            </div>

            {!ratings ? (
                <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
            ) : recent.length === 0 ? (
                <p className={styles.muted}>No ratings here yet.</p>
            ) : (
                <ul className={styles.plainList}>
                    {recent.map((item) => (
                        <li key={item.id} className={styles.ratingRow}>
                            <div className={styles.messageHead}>
                                <span className={styles.scoreChip} data-score={item.score}>
                                    {SCORE_LABEL[item.score]}
                                </span>
                                <strong>{item.who}</strong>
                                <span className={clsx(styles.planChip, { [styles.planChipPro]: item.plan === "pro" })}>
                                    {item.plan}
                                </span>
                                <span className={styles.when}>{new Date(item.createdAt).toLocaleString()}</span>
                            </div>
                            {item.comment ? <p className={styles.messageBody}>{item.comment}</p> : null}
                            <p className={styles.footnote}>
                                {RATING_SURFACE_LABEL[item.surface] ?? item.surface}
                                {item.context ? `: ${item.context}` : ""}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function AdminFeedbackPage() {
    const [filter, setFilter] = useState<Filter>("new");
    const [messages, setMessages] = useState<Message[] | null>(null);
    const [openReports, setOpenReports] = useState(0);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");

    const load = useCallback(async () => {
        try {
            const data = await adminApi<{ messages: Message[]; openReports: number }>(
                `/api/admin/feedback${filter === "all" ? "" : `?status=${filter}`}`,
            );
            setMessages(data.messages);
            setOpenReports(data.openReports);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load feedback.");
        }
    }, [filter]);

    useEffect(() => {
        setMessages(null);
        load();
    }, [load]);

    const mark = async (id: string, status: "new" | "done") => {
        setBusy(id);
        try {
            await adminApi("/api/admin/feedback", postJson("PATCH", { id, status }));
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "That didn't save.");
        } finally {
            setBusy("");
        }
    };

    return (
        <main className={styles.main}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Feedback inbox</h1>
                    <p className={styles.lead}>
                        Messages from the Contact page and answers to the in-app rating. Replies go from your own email.
                    </p>
                </div>
            </header>

            {error ? <p className={styles.error}>{error}</p> : null}

            <RatingsPanel />

            <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Contact messages</h2>
                <div role="radiogroup" aria-label="Show messages" className={styles.segmented}>
                    {(["new", "done", "all"] as Filter[]).map((item) => (
                        <button key={item} type="button" role="radio" aria-checked={filter === item} onClick={() => setFilter(item)}>
                            {item === "new" ? "New" : item === "done" ? "Done" : "All"}
                        </button>
                    ))}
                </div>
            </div>

            <Link href="/admin/reports" className={styles.todayItem}>
                <span>
                    <strong>Forum reports</strong>
                    <small>Waiting for a decision</small>
                </span>
                <b>{openReports}</b>
            </Link>

            {!messages ? (
                <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
            ) : messages.length === 0 ? (
                <p className={styles.muted}>
                    {filter === "new" ? "Nothing new. Messages sent from the Contact page land here." : "No messages here."}
                </p>
            ) : (
                <ul className={styles.plainList}>
                    {messages.map((message) => (
                        <li key={message._id} className={clsx(styles.card, styles.messageCard)}>
                            <div className={styles.messageHead}>
                                <span className={styles.topicChip}>{message.topic}</span>
                                <strong>{message.name}</strong>
                                <a href={`mailto:${message.email}`} className={styles.textLink}>
                                    {message.email}
                                </a>
                                <span className={styles.when}>{new Date(message.createdAt).toLocaleString()}</span>
                            </div>
                            <p className={styles.messageBody}>{message.message}</p>
                            <div className={styles.actionWrap}>
                                <a
                                    href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: your ${message.topic.toLowerCase()} for Expansive Mind`)}`}
                                    className={clsx(styles.actionButton, styles.actionPrimary)}
                                >
                                    Reply
                                </a>
                                <button
                                    type="button"
                                    className={styles.actionButton}
                                    disabled={busy === message._id}
                                    onClick={() => mark(message._id, message.status === "new" ? "done" : "new")}
                                >
                                    {message.status === "new" ? "Mark done" : "Move back to new"}
                                </button>
                                {!message.emailed ? (
                                    <span className={styles.footnote}>The email copy to you didn&apos;t go out; this is the only copy.</span>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
