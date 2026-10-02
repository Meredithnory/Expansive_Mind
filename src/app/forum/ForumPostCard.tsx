"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import ForumComments from "./ForumComments";
import ProfileMark from "../components/ProfileMark";
import ReportButton from "./ReportButton";
import { type ForumPost, when } from "./forum-client";
import { badgeTagLine } from "../lib/lab-badge";
import { REPLAY_MASK } from "../lib/replay-privacy";
import styles from "./forum.module.scss";

export default function ForumPostCard({
    post,
    signedIn,
    onDelete,
    full = false,
}: {
    post: ForumPost;
    signedIn: boolean;
    onDelete?: () => void;
    full?: boolean;
}) {
    const shown = full ? post.highlights : post.highlights.slice(0, 2);
    // Feed cards open comments in place. They load on first open and stay
    // mounted after, so closing slides them away instead of cutting them off.
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentCount, setCommentCount] = useState(post.commentCount);
    const anchor = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const toggleComments = () => {
        setCommentsLoaded(true);
        setCommentsOpen((open) => !open);
    };
    const onCountChange = useCallback((count: number) => setCommentCount(count), []);

    // The panel floats over the page, so it closes like a menu: tap outside or Escape.
    useEffect(() => {
        if (!commentsOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!anchor.current?.contains(event.target as Node)) setCommentsOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setCommentsOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        // If the panel would open below the fold, bring it into view once it has unrolled.
        const timer = window.setTimeout(() => {
            panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 200);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            window.clearTimeout(timer);
        };
    }, [commentsOpen]);
    return (
        <article className={styles.post}>
            <div className={styles.postHead}>
                <Link href={`/forum/people/${post.author.id}`} className={styles.authorLink}>
                    <ProfileMark color={post.author.profileColor} badge={post.author.badge} size={36} />
                    <span className={styles.authorText}>
                        <strong>{post.author.name}</strong>
                        {badgeTagLine(post.author.badge) && (
                            <span className={styles.authorTag}>{badgeTagLine(post.author.badge)}</span>
                        )}
                    </span>
                </Link>
                <span className={styles.meta}>· {when(post.createdAt)}</span>
                <span className={styles.headActions}>
                    <ReportButton targetType="post" targetId={post.id} signedIn={signedIn && !post.canDelete} />
                    {post.canDelete && onDelete && (
                        <button type="button" className={styles.quiet} onClick={onDelete}>
                            Delete
                        </button>
                    )}
                </span>
            </div>
            {post.status && post.status !== "visible" && (
                <p className={styles.statusNote}>
                    {post.status === "hidden"
                        ? "Hidden while it's reviewed after reports. Only you and admins can see it."
                        : "Removed."}
                </p>
            )}
            <Link href={post.paper.href} className={styles.paperTitle}>
                {post.paper.title}
            </Link>
            {post.body && <p className={styles.body}>{post.body}</p>}
            {shown.map((highlight) => (
                <div key={highlight.id} className={styles.highlight} data-color={highlight.color}>
                    {highlight.excerpt ? (
                        <blockquote className={REPLAY_MASK}>{highlight.excerpt}</blockquote>
                    ) : (
                        <p className={styles.hiddenQuote}>
                            Highlight in {highlight.sectionTitle}. This paper&apos;s license
                            doesn&apos;t allow sharing its text, so open it to read.
                        </p>
                    )}
                    <Link href={highlight.href} className={styles.openPassage}>
                        Open in paper →
                    </Link>
                </div>
            ))}
            {!full && post.highlights.length > shown.length && (
                <p className={styles.meta}>+{post.highlights.length - shown.length} more highlights</p>
            )}
            <div ref={anchor} className={styles.commentAnchor}>
            <div className={styles.postFoot}>
                {post.tags.map((tag) => (
                    <Link key={tag} href={`/forum?tag=${tag}`} className={styles.tag}>
                        #{tag}
                    </Link>
                ))}
                {!full && (
                    <button
                        type="button"
                        className={styles.discuss}
                        aria-expanded={commentsOpen}
                        aria-controls={`comments-${post.id}`}
                        onClick={toggleComments}
                    >
                        {commentCount > 0
                            ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
                            : "Discuss"}
                        <span
                            className={clsx(styles.discussChevron, commentsOpen && styles.discussChevronOpen)}
                            aria-hidden="true"
                        />
                    </button>
                )}
            </div>
            {!full && (
                <div
                    ref={panel}
                    id={`comments-${post.id}`}
                    role="region"
                    aria-label="Comments"
                    className={clsx(styles.commentPanel, commentsOpen && styles.commentPanelOpen)}
                    inert={!commentsOpen}
                >
                    {commentsLoaded && (
                        <ForumComments post={post} signedIn={signedIn} onCountChange={onCountChange} />
                    )}
                </div>
            )}
            </div>
        </article>
    );
}
