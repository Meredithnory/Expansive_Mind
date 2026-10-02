"use client";

import { FormEvent, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileMark from "../../components/ProfileMark";
import { REPLAY_MASK } from "../../lib/replay-privacy";
import styles from "../groups.module.scss";

type Person = {
    id: string;
    name: string;
    profileColor: string | null;
    badge?: import("../../lib/lab-badge").Badge;
};
type Member = Person & { role: string; isMe: boolean };
type Comment = {
    id: string;
    highlightId: string | null;
    author: Person;
    body: string;
    createdAt: string;
    canDelete: boolean;
};
type Post = {
    id: string;
    author: Person;
    paper: { title: string; href: string };
    note: string;
    quotable: boolean;
    createdAt: string;
    canDelete: boolean;
    highlights: Array<{
        id: string;
        excerpt: string | null;
        sectionTitle: string;
        color: string;
        href: string;
    }>;
    comments: Comment[];
};
type GroupData = {
    group: { id: string; name: string; role: string; inviteCode: string | null };
    members: Member[];
    posts: Post[];
};

const when = (value: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
        new Date(value),
    );

async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
}

function Thread({
    comments,
    onReply,
    onDelete,
    label,
}: {
    comments: Comment[];
    onReply: (body: string) => Promise<void>;
    onDelete: (commentId: string) => void;
    label: string;
}) {
    const [draft, setDraft] = useState("");
    const [open, setOpen] = useState(comments.length > 0);
    const [sending, setSending] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!draft.trim() || sending) return;
        setSending(true);
        try {
            await onReply(draft);
            setDraft("");
        } finally {
            setSending(false);
        }
    }

    if (!open) {
        return (
            <button type="button" className={styles.replyToggle} onClick={() => setOpen(true)}>
                Reply
            </button>
        );
    }
    return (
        <div className={styles.thread}>
            {comments.map((comment) => (
                <div key={comment.id} className={styles.comment}>
                    <ProfileMark color={comment.author.profileColor} badge={comment.author.badge} size={26} />
                    <div className={styles.commentBody}>
                        <p className={styles.commentMeta}>
                            <strong>{comment.author.name}</strong> · {when(comment.createdAt)}
                            {comment.canDelete && (
                                <button type="button" onClick={() => onDelete(comment.id)}>
                                    Delete
                                </button>
                            )}
                        </p>
                        <p className={styles.commentText}>{comment.body}</p>
                    </div>
                </div>
            ))}
            <form className={styles.replyForm} onSubmit={submit}>
                <textarea
                    value={draft}
                    maxLength={2000}
                    rows={2}
                    placeholder="Add a comment…"
                    aria-label={label}
                    onChange={(event) => setDraft(event.target.value)}
                />
                <button type="submit" disabled={!draft.trim() || sending}>
                    {sending ? "…" : "Post"}
                </button>
            </form>
        </div>
    );
}

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [data, setData] = useState<GroupData | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        const response = await fetch(`/api/groups/${id}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(body.error || "This group couldn't be loaded.");
            return;
        }
        setData(body);
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    const act = async (fn: () => Promise<unknown>, done?: string) => {
        setNotice("");
        try {
            await fn();
            if (done) setNotice(done);
            await load();
        } catch (err) {
            setNotice(err instanceof Error ? err.message : "Something went wrong.");
        }
    };

    if (error) {
        return (
            <main className={styles.page}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>Group not available</p>
                    <p>{error}</p>
                    <Link href="/groups">Back to groups</Link>
                </div>
            </main>
        );
    }
    if (!data) return <main className={styles.page} aria-busy="true" />;

    const { group, members, posts } = data;
    const isOwner = group.role === "owner";
    const me = members.find((member) => member.isMe);
    const ownerIds = new Set(
        members.filter((member) => member.role === "owner").map((member) => member.id),
    );
    const inviteUrl =
        group.inviteCode && typeof window !== "undefined"
            ? `${window.location.origin}/groups/join/${group.inviteCode}`
            : "";

    const reply = (postId: string, highlightId: string | null) => async (body: string) => {
        await act(() => send(`/api/groups/${id}/comments`, "POST", { postId, highlightId, body }));
    };
    const deleteComment = (commentId: string) =>
        void act(() => send(`/api/groups/${id}/comments`, "DELETE", { commentId }));

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <Link href="/groups" className={styles.back}>← Groups</Link>
                <h1>{group.name}</h1>
                <ul className={styles.members} aria-label="Members">
                    {members.map((member) => (
                        <li key={member.id} title={member.name}>
                            <ProfileMark color={member.profileColor} badge={member.badge} size={30} label={member.name} />
                            <span>
                                {member.isMe ? "You" : member.name}
                                {member.role === "owner" ? " (owner)" : ""}
                            </span>
                            {isOwner && !member.isMe && (
                                <button
                                    type="button"
                                    className={styles.linkButton}
                                    onClick={() =>
                                        void act(
                                            () => send(`/api/groups/${id}/members`, "DELETE", { userId: member.id }),
                                            `${member.name} was removed.`,
                                        )
                                    }
                                >
                                    Remove
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </header>

            {isOwner && inviteUrl && (
                <section className={styles.invite}>
                    <h2>Invite people</h2>
                    <p>Anyone with this link can join. Reset it to stop old links from working.</p>
                    <div className={styles.inviteRow}>
                        <input readOnly value={inviteUrl} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} />
                        <button
                            type="button"
                            onClick={() =>
                                void navigator.clipboard
                                    ?.writeText(inviteUrl)
                                    .then(() => setNotice("Invite link copied."))
                                    .catch(() => setNotice("Select the link and copy it."))
                            }
                        >
                            Copy link
                        </button>
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => void act(() => send(`/api/groups/${id}/invite`, "POST"), "New link made. The old one no longer works.")}
                        >
                            Reset link
                        </button>
                    </div>
                </section>
            )}

            {notice && <p className={styles.notice} role="status">{notice}</p>}

            <section className={styles.feed} aria-label="Shared papers">
                {posts.length === 0 ? (
                    <div className={styles.empty}>
                        <p className={styles.emptyTitle}>Nothing shared yet</p>
                        <p>
                            Highlight a paper, then go to Library → Highlights and
                            tap “Share to group”.
                        </p>
                        <Link href="/savedpapers?tab=highlights">Go to my highlights</Link>
                    </div>
                ) : (
                    posts.map((post) => (
                        <article key={post.id} className={styles.post}>
                            <div className={styles.postHead}>
                                <ProfileMark color={post.author.profileColor} badge={post.author.badge} size={34} />
                                <p>
                                    <strong>{post.author.name}</strong>
                                    <span> shared · {when(post.createdAt)}</span>
                                </p>
                                {post.canDelete && (
                                    <button
                                        type="button"
                                        className={styles.linkButton}
                                        onClick={() => void act(() => send(`/api/groups/${id}/posts`, "DELETE", { postId: post.id }))}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                            <Link href={post.paper.href} className={styles.paperTitle}>
                                {post.paper.title}
                            </Link>
                            {post.note && (
                                <div className={styles.note}>
                                    <ProfileMark color={post.author.profileColor} badge={post.author.badge} size={26} />
                                    <div className={styles.commentBody}>
                                        <p className={styles.commentMeta}>
                                            <strong>{post.author.name}</strong>
                                            <span className={styles.authorBadge}>
                                                {ownerIds.has(post.author.id) ? "Owner" : "Author"}
                                            </span>
                                        </p>
                                        <p className={styles.noteText}>{post.note}</p>
                                    </div>
                                </div>
                            )}

                            {post.highlights.map((highlight) => (
                                <div key={highlight.id} className={styles.highlight} data-color={highlight.color}>
                                    {highlight.excerpt ? (
                                        <blockquote className={REPLAY_MASK}>{highlight.excerpt}</blockquote>
                                    ) : (
                                        <p className={styles.hiddenQuote}>
                                            Highlight in {highlight.sectionTitle}. This paper&apos;s
                                            license doesn&apos;t allow sharing its text, so open it to read.
                                        </p>
                                    )}
                                    <Link href={highlight.href} className={styles.openPassage}>
                                        Open in paper →
                                    </Link>
                                    <Thread
                                        label="Comment on this highlight"
                                        comments={post.comments.filter((c) => c.highlightId === highlight.id)}
                                        onReply={reply(post.id, highlight.id)}
                                        onDelete={deleteComment}
                                    />
                                </div>
                            ))}

                            <Thread
                                label="Comment on this post"
                                comments={post.comments.filter((c) => !c.highlightId)}
                                onReply={reply(post.id, null)}
                                onDelete={deleteComment}
                            />
                        </article>
                    ))
                )}
            </section>

            <footer className={styles.groupFooter}>
                {isOwner ? (
                    <button
                        type="button"
                        className={styles.danger}
                        onClick={() => {
                            const typed = window.prompt(`Delete "${group.name}" and everything shared in it? Type the group name to confirm.`);
                            if (typed?.trim() !== group.name) return;
                            void send(`/api/groups/${id}`, "DELETE")
                                .then(() => router.replace("/groups"))
                                .catch((err) => setNotice(err.message));
                        }}
                    >
                        Delete group
                    </button>
                ) : me ? (
                    <button
                        type="button"
                        className={styles.danger}
                        onClick={() => {
                            if (!window.confirm(`Leave "${group.name}"?`)) return;
                            void send(`/api/groups/${id}/members`, "DELETE", { userId: me.id })
                                .then(() => router.replace("/groups"))
                                .catch((err) => setNotice(err.message));
                        }}
                    >
                        Leave group
                    </button>
                ) : null}
            </footer>
        </main>
    );
}
