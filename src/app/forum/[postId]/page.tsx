"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../../lib/use-session";
import ForumComments from "../ForumComments";
import ForumPostCard from "../ForumPostCard";
import { type ForumPost, send } from "../forum-client";
import styles from "../forum.module.scss";

export default function ForumPostPage({ params }: { params: Promise<{ postId: string }> }) {
    const { postId } = use(params);
    const router = useRouter();
    const { isLoggedIn } = useSession();
    const [post, setPost] = useState<ForumPost | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const response = await fetch(`/api/forum/${postId}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(data.error || "This post isn't available.");
            return;
        }
        setPost(data.post);
    }, [postId]);

    useEffect(() => {
        void load();
    }, [load]);

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

    return (
        <main className={styles.page}>
            <Link href="/forum" className={styles.back}>← Forum</Link>
            <ForumPostCard
                post={post}
                full
                signedIn={isLoggedIn}
                onDelete={() => void send(`/api/forum/${post.id}`, "DELETE").then(() => router.replace("/forum"))}
            />
            <ForumComments post={post} signedIn={isLoggedIn} showHeading />
        </main>
    );
}
