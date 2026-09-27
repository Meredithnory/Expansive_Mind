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
    // "public" posts to the forum; anything else is a group id.
    const [groupId, setGroupId] = useState("public");
    const [tags, setTags] = useState("");
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
        const isPublic = groupId === "public";
        const payload = {
            database: paper.database,
            paperId: paper.paperId,
            idName: paper.idName,
            highlightIds: [...picked].slice(0, isPublic ? 10 : 20),
        };
        const response = await fetch(isPublic ? "/api/forum" : `/api/groups/${groupId}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
                isPublic ? { ...payload, body: note, tags } : { ...payload, note },
            ),
        });
        const data = await response.json().catch(() => ({}));
        setSending(false);
        if (!response.ok) {
            setStatus(data.error || "Sharing didn't work. Try again.");
            return;
        }
        setSharedTo(isPublic ? `/forum/${data.postId}` : `/groups/${groupId}`);
        setStatus(
            data.quotable
                ? "Shared."
                : "Shared. This paper's license doesn't allow sharing its text, so members see where each highlight is and open the paper to read it.",
        );
    }

    return (
        <form className={styles.sharePanel} onSubmit={share}>
            <div className={styles.shareHead}>
                <h3>Share this paper</h3>
                <button type="button" onClick={onClose} aria-label="Close">
                    ×
                </button>
            </div>
            {groups === null ? (
                <p className={styles.emptyMessage}>Loading your groups…</p>
            ) : sharedTo ? (
                <>
                    <p className={styles.emptyMessage}>{status}</p>
                    <Link href={sharedTo} className={styles.shareButton}>
                        {sharedTo.startsWith("/forum") ? "View your post" : "Open the group"}
                    </Link>
                </>
            ) : (
                <>
                    <label className={styles.shareLabel}>
                        Share to
                        <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                            <option value="public">Public forum (anyone can read)</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    Group: {group.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {groupId === "public" && (
                        <label className={styles.shareLabel}>
                            Topics (up to 3)
                            <input
                                value={tags}
                                maxLength={100}
                                placeholder="e.g. immunology crispr"
                                onChange={(event) => setTags(event.target.value)}
                            />
                        </label>
                    )}
                    {groups.length === 0 && groupId === "public" && (
                        <p className={styles.emptyMessage}>
                            Want to share privately instead? <Link href="/groups">Create a group</Link>.
                        </p>
                    )}
                    <label className={styles.shareLabel}>
                        {groupId === "public" ? "Your take (optional)" : "Note (optional)"}
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
