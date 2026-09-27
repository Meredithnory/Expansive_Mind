"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProfileMark from "../../../components/ProfileMark";
import { useSession } from "../../../lib/use-session";
import ForumPostCard from "../../ForumPostCard";
import { type ForumPost, send } from "../../forum-client";
import styles from "../../forum.module.scss";

type PersonProfile = {
    id: string;
    name: string;
    profileColor: string | null;
    followers: number;
    following: number;
    posts: number;
    isMe: boolean;
    isFollowing: boolean;
    isBlocked: boolean;
};

export default function ForumPersonPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const { isLoggedIn } = useSession();
    const [person, setPerson] = useState<PersonProfile | null>(null);
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const [profileResponse, postsResponse] = await Promise.all([
            fetch(`/api/forum/people/${userId}`, { cache: "no-store" }),
            fetch(`/api/forum?author=${userId}`, { cache: "no-store" }),
        ]);
        const profile = await profileResponse.json().catch(() => ({}));
        if (!profileResponse.ok) {
            setError(profile.error || "This person isn't available.");
            return;
        }
        const feed = await postsResponse.json().catch(() => ({}));
        setPerson(profile.person);
        setPosts(feed.posts || []);
    }, [userId]);

    useEffect(() => {
        void load();
    }, [load]);

    if (error) {
        return (
            <main className={styles.page}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>Not found</p>
                    <p>{error}</p>
                    <Link href="/forum">Back to the forum</Link>
                </div>
            </main>
        );
    }
    if (!person) return <main className={styles.page} aria-busy="true" />;

    const toggle = (kind: "follow" | "block", on: boolean) =>
        void send(`/api/forum/${kind}`, on ? "DELETE" : "POST", { userId }).then(load);

    return (
        <main className={styles.page}>
            <Link href="/forum" className={styles.back}>← Forum</Link>
            <header className={styles.personHeader}>
                <ProfileMark color={person.profileColor} size={72} />
                <h1>{person.name}</h1>
                <p className={styles.meta}>
                    {person.posts} posts · {person.followers} followers · {person.following} following
                </p>
                {isLoggedIn && !person.isMe && (
                    <div className={styles.personActions}>
                        {!person.isBlocked && (
                            <button type="button" onClick={() => toggle("follow", person.isFollowing)}>
                                {person.isFollowing ? "Following ✓" : "Follow"}
                            </button>
                        )}
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => {
                                if (!person.isBlocked && !window.confirm(`Block ${person.name}? You won't see their posts or comments.`)) return;
                                toggle("block", person.isBlocked);
                            }}
                        >
                            {person.isBlocked ? "Unblock" : "Block"}
                        </button>
                    </div>
                )}
            </header>
            {person.isBlocked ? (
                <p className={styles.lede}>You blocked this person, so their posts are hidden.</p>
            ) : posts.length === 0 ? (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>No posts yet</p>
                </div>
            ) : (
                <div className={styles.feed}>
                    {posts.map((post) => (
                        <ForumPostCard
                            key={post.id}
                            post={post}
                            signedIn={isLoggedIn}
                            onDelete={() => void send(`/api/forum/${post.id}`, "DELETE").then(load)}
                        />
                    ))}
                </div>
            )}
        </main>
    );
}
