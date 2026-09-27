"use client";

import Link from "next/link";
import ProfileMark from "../components/ProfileMark";
import ReportButton from "./ReportButton";
import { type ForumPost, when } from "./forum-client";
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
    return (
        <article className={styles.post}>
            <div className={styles.postHead}>
                <Link href={`/forum/people/${post.author.id}`} className={styles.authorLink}>
                    <ProfileMark color={post.author.profileColor} size={34} />
                    <strong>{post.author.name}</strong>
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
                        <blockquote>{highlight.excerpt}</blockquote>
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
            <div className={styles.postFoot}>
                {post.tags.map((tag) => (
                    <Link key={tag} href={`/forum?tag=${tag}`} className={styles.tag}>
                        #{tag}
                    </Link>
                ))}
                {!full && (
                    <Link href={`/forum/${post.id}`} className={styles.discuss}>
                        {post.commentCount > 0
                            ? `${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`
                            : "Discuss"}{" "}
                        →
                    </Link>
                )}
            </div>
        </article>
    );
}
