"use client";

import { useEffect, useState } from "react";
import { adminApi } from "../../admin-api";
import styles from "../../admin.module.scss";

type AuditEntry = {
    _id: string;
    adminEmail: string;
    action: string;
    target: string;
    createdAt: string;
};

export default function AdminAuditPage() {
    const [entries, setEntries] = useState<AuditEntry[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        adminApi<{ entries: AuditEntry[] }>("/api/admin/audit")
            .then((data) => setEntries(data.entries))
            .catch((err) => setError(err instanceof Error ? err.message : "Unable to load the audit log."));
    }, []);

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Audit log</h1>
                </div>
                <span className={styles.muted}>Last 100 admin actions</span>
            </header>
            {error && <p className={styles.error}>{error}</p>}
            {!entries && !error ? <p className={styles.muted}>Loading…</p> : null}
            {entries ? (
                <section className={styles.panel}>
                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead>
                                <tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr key={entry._id}>
                                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                        <td>{entry.adminEmail}</td>
                                        <td>{entry.action}</td>
                                        <td>{entry.target}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : null}
        </main>
    );
}
