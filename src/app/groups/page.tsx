"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./groups.module.scss";

type GroupSummary = { id: string; name: string; role: string; memberCount: number };

export default function GroupsPage() {
    const router = useRouter();
    const [groups, setGroups] = useState<GroupSummary[] | null>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        const response = await fetch("/api/groups", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(data.error || "Groups could not be loaded.");
            setGroups([]);
            return;
        }
        setGroups(data.groups || []);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function create(event: FormEvent) {
        event.preventDefault();
        if (!name.trim() || creating) return;
        setCreating(true);
        setError("");
        const response = await fetch("/api/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const data = await response.json().catch(() => ({}));
        setCreating(false);
        if (!response.ok) {
            setError(data.error || "The group couldn't be created.");
            return;
        }
        router.push(`/groups/${data.group.id}`);
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <p className={styles.eyebrow}>Private groups</p>
                <h1>Read papers together</h1>
                <p className={styles.lede}>
                    Share papers and highlights with your lab or study group,
                    and talk through them. Only members can see a group.
                </p>
            </header>

            <form className={styles.createForm} onSubmit={create}>
                <label htmlFor="new-group-name" className={styles.srOnly}>
                    Group name
                </label>
                <input
                    id="new-group-name"
                    value={name}
                    maxLength={60}
                    placeholder="Name a new group, e.g. Smith Lab"
                    onChange={(event) => setName(event.target.value)}
                />
                <button type="submit" disabled={!name.trim() || creating}>
                    {creating ? "Creating…" : "Create group"}
                </button>
            </form>
            {error && <p className={styles.error} role="alert">{error}</p>}

            {groups === null ? (
                <div className={styles.list} aria-busy="true">
                    {[0, 1].map((item) => (
                        <div key={item} className={`${styles.card} loading-skeleton`} />
                    ))}
                </div>
            ) : groups.length === 0 ? (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>No groups yet</p>
                    <p>
                        Create one above, then send the invite link to your
                        labmates. If someone sent you a link, open it to join.
                    </p>
                </div>
            ) : (
                <ul className={styles.list}>
                    {groups.map((group) => (
                        <li key={group.id}>
                            <Link href={`/groups/${group.id}`} className={styles.card}>
                                <h2>{group.name}</h2>
                                <p>
                                    {group.memberCount}{" "}
                                    {group.memberCount === 1 ? "member" : "members"}
                                    {group.role === "owner" ? " · You own this group" : ""}
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
