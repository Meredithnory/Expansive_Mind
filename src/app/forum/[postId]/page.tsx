"use client";

import { FormEvent, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileMark from "../../components/ProfileMark";
import { useSession } from "../../lib/use-session";
import ForumPostCard from "../ForumPostCard";
import ReportButton from "../ReportButton";
import { type ForumPost, type Person, send, when } from "../forum-client";
import styles from "../forum.module.scss";

type Comment = {
    id: string;
    highlightId: string | null;
    author: Person;
    body: string;
    createdAt: string;
    canDelete: boolean;
};

export default function ForumPostPage({ params }: { params: Promise<{ postId: string }> }) {
    const { postId } = use(params);
    const router = useRouter();
    const { isLoggedIn } = useSession();
    const [post, setPost] = useState<ForumPost | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [error, setError] = useState("");
    const [draft, setDraft] = useState("");
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        const response = await fetch(`/api/forum/${postId}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(data.error || "This post isn't available.");
            return;
        }
        setPost(data.post);
        setComments(data.comments);
    }, [postId]);

    useEffect(() => {
        void load();
    }, [load]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!draft.trim()) return;
        try {
            await send(`/api/forum/${postId}/comments`, "POST", { body: draft, highlightId: replyTo });
            setDraft("");
            setReplyTo(null);
            setNotice("");
            await load();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : "Your comment didn't post.");
        }
    }

    if (error) {
        return (
            <main className={styles.page}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>Post not available</p>
                    <p>{error}</p>
                    <Link href="/forum">Back to the forum</Link>
                </div>
            </main>
        );
    }
    if (!post) return <main className={styles.page} aria-busy="true" />;

    const highlightLabel = (id: string | null) => {
        if (!id) return null;
        const index = post.highlights.findIndex((highlight) => highlight.id === id);
        return index >= 0 ? `on highlight ${index + 1}` : null;
    };

    return (
        <main className={styles.page}>
            <Link href="/forum" className={styles.back}>← Forum</Link>
            <ForumPostCard
                post={post}
                full
                signedIn={isLoggedIn}
                onDelete={() => void send(`/api/forum/${post.id}`, "DELETE").then(() => router.replace("/forum"))}
            />

            <section className={styles.comments} aria-label="Comments">
                <h2>
                    {comments.length} {comments.length === 1 ? "comment" : "comments"}
                </h2>
                {comments.map((comment) => (
                    <div key={comment.id} className={styles.comment}>
                        <Link href={`/forum/people/${comment.author.id}`}>
                            <ProfileMark color={comment.author.profileColor} size={28} />
                        </Link>
                        <div className={styles.commentBody}>
                            <p className={styles.commentMeta}>
                                <Link href={`/forum/people/${comment.author.id}`}>
                                    <strong>{comment.author.name}</strong>
                                </Link>{" "}
                                · {when(comment.createdAt)}
                                {highlightLabel(comment.highlightId) && ` · ${highlightLabel(comment.highlightId)}`}
                                <ReportButton targetType="comment" targetId={comment.id} signedIn={isLoggedIn && !comment.canDelete} />
                                {comment.canDelete && (
                                    <button
                                        type="button"
                                        className={styles.quiet}
                                        onClick={() =>
                                            void send(`/api/forum/${postId}/comments`, "DELETE", { commentId: comment.id }).then(load)
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

                {isLoggedIn ? (
                    <form className={styles.replyForm} onSubmit={submit}>
                        {post.highlights.length > 0 && (
                            <select
                                aria-label="Comment on"
                                value={replyTo ?? ""}
                                onChange={(event) => setReplyTo(event.target.value || null)}
                            >
                                <option value="">On the post</option>
                                {post.highlights.map((highlight, index) => (
                                    <option key={highlight.id} value={highlight.id}>
                                        On highlight {index + 1}
                                    </option>
                                ))}
                            </select>
                        )}
                        <textarea
                            value={draft}
                            rows={3}
                            maxLength={2000}
                            placeholder="Add to the discussion…"
                            aria-label="Comment"
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <button type="submit" disabled={!draft.trim()}>
                            Post comment
                        </button>
                        {notice && <p className={styles.notice} role="alert">{notice}</p>}
                    </form>
                ) : (
                    <p className={styles.lede}>
                        <Link href={`/login?next=/forum/${postId}`}>Sign in</Link> to join the discussion.
                    </p>
                )}
            </section>
        </main>
    );
}
