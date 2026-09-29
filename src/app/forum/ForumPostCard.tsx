"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import ForumComments from "./ForumComments";
import ProfileMark from "../components/ProfileMark";
import ReportButton from "./ReportButton";
import { type ForumPost, when } from "./forum-client";
import { badgeTagLine } from "../lib/lab-badge";
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
    // Feed cards open comments under the post. They load on first open and
    // stay mounted after, so closing folds them away instead of cutting off.
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentCount, setCommentCount] = useState(post.commentCount);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLSpanElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const toggleComments = () => {
        setCommentsLoaded(true);
        setCommentsOpen((open) => !open);
    };
    const onCountChange = useCallback((count: number) => setCommentCount(count), []);
    const canReport = signedIn && !post.canDelete;
    const canDelete = post.canDelete && Boolean(onDelete);

    // Bring the thread into view once it has unrolled, if it opened below the fold.
    useEffect(() => {
        if (!commentsOpen) return;
        const timer = window.setTimeout(() => {
            panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 260);
        return () => window.clearTimeout(timer);
    }, [commentsOpen]);

    // The post menu closes like a menu: tap outside or Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [menuOpen]);
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
                {(canReport || canDelete) && (
                    <span className={styles.headActions} ref={menuRef}>
                        <button
                            type="button"
                            className={styles.menuButton}
                            aria-label="Post options"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            ⋯
                        </button>
                        {menuOpen && (
                            <span className={styles.menu} role="menu">
                                {canReport && (
                                    <ReportButton targetType="post" targetId={post.id} signedIn />
                                )}
                                {canDelete && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className={styles.quiet}
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onDelete?.();
                                        }}
                                    >
                                        Delete post
                                    </button>
                                )}
                            </span>
                        )}
                    </span>
                )}
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
            {shown.map((highlight, index) => (
                <div
                    key={highlight.id}
                    className={clsx(styles.highlight, !highlight.excerpt && styles.highlightHidden)}
                    data-color={highlight.excerpt ? highlight.color : undefined}
                >
                    {highlight.excerpt ? (
                        <blockquote>{highlight.excerpt}</blockquote>
                    ) : (
                        <p className={styles.hiddenQuote}>
                            Highlight in {highlight.sectionTitle}. This paper&apos;s license
                            doesn&apos;t allow sharing its text, so open it to read.
                        </p>
                    )}
                    <span className={styles.highlightFoot}>
                        <span>
                            {highlight.excerpt
                                ? `Highlight ${index + 1} · ${highlight.sectionTitle}`
                                : ""}
                        </span>
                        <Link href={highlight.href} className={styles.openPassage}>
                            Open in paper →
                        </Link>
                    </span>
                </div>
            ))}
            {!full && post.highlights.length > shown.length && (
                <p className={styles.meta}>+{post.highlights.length - shown.length} more highlights</p>
            )}
            <div className={styles.commentAnchor}>
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M5 5h14v10H10l-4 4v-4H5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        {commentCount > 0
                            ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
                            : "Discuss"}
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
