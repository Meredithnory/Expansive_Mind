"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "../admin.module.scss";

type Report = {
    targetType: "post" | "comment";
    targetId: string;
    postId: string;
    title: string | null;
    text: string;
    status: string;
    author: { name: string; email: string } | null;
    count: number;
    reasons: string[];
    details: string[];
    lastAt: string;
};

const ACTIONS: Array<{ id: string; label: string; danger?: boolean }> = [
    { id: "dismiss", label: "Dismiss (keep)" },
    { id: "restore", label: "Restore" },
    { id: "hide", label: "Hide" },
    { id: "remove", label: "Remove", danger: true },
];

export default function AdminForumReports() {
    const [reports, setReports] = useState<Report[] | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");

    const load = useCallback(async () => {
        const response = await fetch("/api/admin/forum", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(data.error || "Reports could not be loaded.");
            return;
        }
        setReports(data.reports || []);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function act(report: Report, action: string) {
        setBusy(`${report.targetId}:${action}`);
        setError("");
        const response = await fetch("/api/admin/forum", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetType: report.targetType, targetId: report.targetId, action }),
        });
        const data = await response.json().catch(() => ({}));
        setBusy("");
        if (!response.ok) setError(data.error || "That didn't work.");
        await load();
    }

    return (
        <section className={styles.panel}>
            <p className={styles.muted}>
                Reported forum posts and comments. Items reported by 3 or more
                people are already hidden until you decide.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            {reports === null ? (
                <p className={styles.muted}>Loading…</p>
            ) : reports.length === 0 ? (
                <p className={styles.muted}>Nothing to review.</p>
            ) : (
                <div className={styles.tableScroll}>
                    <table className={`${styles.table} ${styles.stackOnPhone}`}>
                        <thead>
                            <tr><th>Reported</th><th>Why</th><th>Status</th><th>Decide</th></tr>
                        </thead>
                        <tbody>
                            {reports.map((report) => (
                                <tr key={report.targetId}>
                                    <td data-label="Reported">
                                        <strong>{report.targetType === "post" ? report.title || "Post" : "Comment"}</strong>
                                        <span className={styles.muted}>{report.text.slice(0, 280) || "(no text)"}</span>
                                        <span className={styles.muted}>
                                            by {report.author ? `${report.author.name} (${report.author.email})` : "deleted user"} ·{" "}
                                            <Link href={`/forum/${report.postId}`} target="_blank">open</Link>
                                        </span>
                                    </td>
                                    <td data-label="Why">
                                        {report.count} {report.count === 1 ? "report" : "reports"}: {[...new Set(report.reasons)].join(", ")}
                                        {report.details.length > 0 && (
                                            <span className={styles.muted}>“{report.details.join("” · “")}”</span>
                                        )}
                                    </td>
                                    <td data-label="Status">{report.status}</td>
                                    <td data-label="Decide">
                                        <div className={styles.actions}>
                                            {ACTIONS.map((action) => (
                                                <button
                                                    key={action.id}
                                                    type="button"
                                                    className={action.danger ? styles.danger : styles.button}
                                                    disabled={Boolean(busy)}
                                                    onClick={() => void act(report, action.id)}
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
