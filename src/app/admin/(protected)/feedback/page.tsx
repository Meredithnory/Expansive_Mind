"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { adminApi, postJson } from "../../admin-api";
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
                    <p className={styles.lead}>Messages from the Contact page. Replies go from your own email.</p>
                </div>
                <div role="radiogroup" aria-label="Show" className={styles.segmented}>
                    {(["new", "done", "all"] as Filter[]).map((item) => (
                        <button key={item} type="button" role="radio" aria-checked={filter === item} onClick={() => setFilter(item)}>
                            {item === "new" ? "New" : item === "done" ? "Done" : "All"}
                        </button>
                    ))}
                </div>
            </header>

            {error ? <p className={styles.error}>{error}</p> : null}

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
