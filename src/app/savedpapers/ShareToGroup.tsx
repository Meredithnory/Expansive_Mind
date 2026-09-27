"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { HighlightNotesPaper } from "../lib/highlight-notes";
import styles from "./savedpage.module.scss";

type GroupOption = { id: string; name: string };

export default function ShareToGroup({
    paper,
    onClose,
}: {
    paper: HighlightNotesPaper;
    onClose: () => void;
}) {
    const [groups, setGroups] = useState<GroupOption[] | null>(null);
    const [groupId, setGroupId] = useState("");
    const [note, setNote] = useState("");
    const [picked, setPicked] = useState<Set<string>>(
        () => new Set(paper.highlights.map((highlight) => highlight.id)),
    );
    const [status, setStatus] = useState("");
    const [sending, setSending] = useState(false);
    const [sharedTo, setSharedTo] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            const response = await fetch("/api/groups", { cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            const list: GroupOption[] = response.ok ? data.groups || [] : [];
            setGroups(list);
            if (list[0]) setGroupId(list[0].id);
        })();
    }, []);

    function toggle(id: string) {
        setPicked((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function share(event: FormEvent) {
        event.preventDefault();
        if (!groupId || sending) return;
        setSending(true);
        setStatus("");
        const response = await fetch(`/api/groups/${groupId}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                database: paper.database,
                paperId: paper.paperId,
                idName: paper.idName,
                note,
                highlightIds: [...picked],
            }),
        });
        const data = await response.json().catch(() => ({}));
        setSending(false);
        if (!response.ok) {
            setStatus(data.error || "Sharing didn't work. Try again.");
            return;
        }
        setSharedTo(groupId);
        setStatus(
            data.quotable
                ? "Shared."
                : "Shared. This paper's license doesn't allow sharing its text, so members see where each highlight is and open the paper to read it.",
        );
    }

    return (
        <form className={styles.sharePanel} onSubmit={share}>
            <div className={styles.shareHead}>
                <h3>Share to a group</h3>
                <button type="button" onClick={onClose} aria-label="Close">
                    ×
                </button>
            </div>
            {groups === null ? (
                <p className={styles.emptyMessage}>Loading your groups…</p>
            ) : groups.length === 0 ? (
                <p className={styles.emptyMessage}>
                    You&apos;re not in a group yet. <Link href="/groups">Create one</Link>{" "}
                    and invite your labmates.
                </p>
            ) : sharedTo ? (
                <>
                    <p className={styles.emptyMessage}>{status}</p>
                    <Link href={`/groups/${sharedTo}`} className={styles.shareButton}>
                        Open the group
                    </Link>
                </>
            ) : (
                <>
                    <label className={styles.shareLabel}>
                        Group
                        <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.shareLabel}>
                        Note (optional)
                        <textarea
                            value={note}
                            maxLength={1000}
                            rows={3}
                            placeholder="Why this paper matters, or a question for the group"
                            onChange={(event) => setNote(event.target.value)}
                        />
                    </label>
                    <fieldset className={styles.sharePicks}>
                        <legend>Highlights to include</legend>
                        {paper.highlights.map((highlight) => (
                            <label key={highlight.id}>
                                <input
                                    type="checkbox"
                                    checked={picked.has(highlight.id)}
                                    onChange={() => toggle(highlight.id)}
                                />
                                <span>{highlight.excerpt}</span>
                            </label>
                        ))}
                    </fieldset>
                    {status && <p className={styles.emptyMessage} role="alert">{status}</p>}
                    <button
                        type="submit"
                        className={styles.shareButton}
                        disabled={sending || (!note.trim() && picked.size === 0)}
                    >
                        {sending ? "Sharing…" : "Share"}
                    </button>
                </>
            )}
        </form>
    );
}
