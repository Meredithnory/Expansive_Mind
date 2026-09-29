"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProfileMark from "../components/ProfileMark";
import ReportButton from "./ReportButton";
import { type ForumPost, type Person, send, when } from "./forum-client";
import styles from "./forum.module.scss";

type Comment = {
    id: string;
    highlightId: string | null;
    author: Person;
    body: string;
    createdAt: string;
    canDelete: boolean;
};

/** A post's comments and reply box. Used on the post page and inside feed cards. */
export default function ForumComments({
    post,
    signedIn,
    showHeading = false,
    onCountChange,
}: {
    post: ForumPost;
    signedIn: boolean;
    showHeading?: boolean;
    onCountChange?: (count: number) => void;
}) {
    const [comments, setComments] = useState<Comment[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [draft, setDraft] = useState("");
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        const response = await fetch(`/api/forum/${post.id}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setLoadError(data.error || "Comments couldn't load.");
            return;
        }
        setLoadError("");
        setComments(data.comments);
        onCountChange?.(data.comments.length);
    }, [post.id, onCountChange]);

    useEffect(() => {
        void load();
    }, [load]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!draft.trim()) return;
        try {
            await send(`/api/forum/${post.id}/comments`, "POST", { body: draft, highlightId: replyTo });
            setDraft("");
            setReplyTo(null);
            setNotice("");
            await load();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : "Your comment didn't post.");
        }
    }

    const highlightLabel = (id: string | null) => {
        if (!id) return null;
        const index = post.highlights.findIndex((highlight) => highlight.id === id);
        return index >= 0 ? `on highlight ${index + 1}` : null;
    };

    return (
        <section className={styles.comments} aria-label="Comments">
            {showHeading && comments && (
                <h2>
                    {comments.length} {comments.length === 1 ? "comment" : "comments"}
                </h2>
            )}
            {loadError && <p className={styles.notice} role="alert">{loadError}</p>}
            {!comments && !loadError && <p className={styles.meta}>Loading comments…</p>}
            {comments?.map((comment) => (
                <div key={comment.id} className={styles.comment}>
                    <Link href={`/forum/people/${comment.author.id}`}>
                        <ProfileMark color={comment.author.profileColor} badge={comment.author.badge} size={28} />
                    </Link>
                    <div className={styles.commentBody}>
                        <p className={styles.commentMeta}>
                            <Link href={`/forum/people/${comment.author.id}`}>
                                <strong>{comment.author.name}</strong>
                            </Link>{" "}
                            · {when(comment.createdAt)}
                            {highlightLabel(comment.highlightId) && ` · ${highlightLabel(comment.highlightId)}`}
                            <ReportButton targetType="comment" targetId={comment.id} signedIn={signedIn && !comment.canDelete} />
                            {comment.canDelete && (
                                <button
                                    type="button"
                                    className={styles.quiet}
                                    onClick={() =>
                                        void send(`/api/forum/${post.id}/comments`, "DELETE", { commentId: comment.id }).then(load)
                                    }
                                >
                                    Delete
                                </button>
                            )}
                        </p>
                        <p className={styles.commentText}>{comment.body}</p>
                    </div>
                </div>
            ))}

            {signedIn ? (
                <form className={styles.replyForm} onSubmit={submit}>
                    <textarea
                        value={draft}
                        rows={2}
                        maxLength={2000}
                        placeholder="Add to the discussion…"
                        aria-label="Comment"
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <div className={styles.replyActions}>
                        {post.highlights.length > 0 && (
                            <select
                                aria-label="Comment on"
                                value={replyTo ?? ""}
                                onChange={(event) => setReplyTo(event.target.value || null)}
                            >
                                <option value="">The whole post</option>
                                {post.highlights.map((highlight, index) => (
                                    <option key={highlight.id} value={highlight.id}>
                                        On highlight {index + 1}
                                    </option>
                                ))}
                            </select>
                        )}
                        <button type="submit" disabled={!draft.trim()}>
                            Post comment
                        </button>
                    </div>
                    {notice && <p className={styles.notice} role="alert">{notice}</p>}
                </form>
            ) : (
                <p className={styles.lede}>
                    <Link href={`/login?next=/forum/${post.id}`}>Sign in</Link> to join the discussion.
                </p>
            )}
        </section>
    );
}
