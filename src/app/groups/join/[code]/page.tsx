"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../groups.module.scss";

type Preview = { id: string; name: string; memberCount: number; alreadyMember: boolean };

export default function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState("");
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        void (async () => {
            const response = await fetch(`/api/groups/join?code=${encodeURIComponent(code)}`, {
                cache: "no-store",
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(data.error || "This invite link isn't valid.");
                return;
            }
            setPreview(data.group);
        })();
    }, [code]);

    async function join() {
        setJoining(true);
        const response = await fetch("/api/groups/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        const data = await response.json().catch(() => ({}));
        setJoining(false);
        if (!response.ok) {
            setError(data.error || "You couldn't join this group.");
            return;
        }
        router.replace(`/groups/${data.groupId}`);
    }

    return (
        <main className={styles.page}>
            <section className={styles.joinCard}>
                {error ? (
                    <>
                        <h1>Invite not found</h1>
                        <p className={styles.lede}>{error}</p>
                    </>
                ) : !preview ? (
                    <p className={styles.lede} aria-busy="true">Checking your invite…</p>
                ) : (
                    <>
                        <p className={styles.eyebrow}>You&apos;re invited</p>
                        <h1>{preview.name}</h1>
                        <p className={styles.lede}>
                            {preview.memberCount}{" "}
                            {preview.memberCount === 1 ? "member" : "members"}. Members
                            share papers and highlights and discuss them. Only
                            members can see the group.
                        </p>
                        {preview.alreadyMember ? (
                            <button onClick={() => router.replace(`/groups/${preview.id}`)}>
                                Open group
                            </button>
                        ) : (
                            <button onClick={() => void join()} disabled={joining}>
                                {joining ? "Joining…" : "Join group"}
                            </button>
                        )}
                    </>
                )}
            </section>
        </main>
    );
}
