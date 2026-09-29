"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../lib/use-session";
import ForumPostCard from "./ForumPostCard";
import { type ForumPost, send } from "./forum-client";
import styles from "./forum.module.scss";

function Feed() {
    const router = useRouter();
    const params = useSearchParams();
    const { isLoggedIn } = useSession();
    const tag = params.get("tag");
    const feed = params.get("feed") === "following" ? "following" : "latest";
    const [posts, setPosts] = useState<ForumPost[] | null>(null);
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
    const [error, setError] = useState("");

    const load = useCallback(
        async (before?: string) => {
            const query = new URLSearchParams({ feed });
            if (tag) query.set("tag", tag);
            if (before) query.set("before", before);
            const response = await fetch(`/api/forum?${query}`, { cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(data.error || "The forum couldn't be loaded.");
                setPosts((current) => current ?? []);
                return;
            }
            setError("");
            setPosts((current) => (before && current ? [...current, ...data.posts] : data.posts));
            setNextBefore(data.nextBefore);
        },
        [feed, tag],
    );

    useEffect(() => {
        setPosts(null);
        void load();
    }, [load]);

    useEffect(() => {
        void fetch("/api/forum/tags")
            .then((response) => response.json())
            .then((data) => setTags(data.tags || []))
            .catch(() => undefined);
    }, []);

    const go = (next: { feed?: string; tag?: string | null }) => {
        const query = new URLSearchParams();
        const nextFeed = next.feed ?? feed;
        const nextTag = next.tag === undefined ? tag : next.tag;
        if (nextFeed === "following") query.set("feed", "following");
        if (nextTag) query.set("tag", nextTag);
        router.push(`/forum${query.size ? `?${query}` : ""}`);
    };

    const railTopics = tags.slice(0, 8);

    return (
        <main className={`${styles.page} ${styles.pageWide}`}>
            <div className={styles.layout}>
                <div className={styles.main}>
                    <header className={`${styles.header} ${styles.headerRow}`}>
                        <div className={styles.header}>
                            <p className={styles.eyebrow}>Forum</p>
                            <h1>What researchers are reading</h1>
                            <p className={styles.lede}>
                                Papers people shared, with their highlights and takes.
                                Every quote links to the exact place in the paper.
                            </p>
                        </div>
                        {isLoggedIn ? (
                            <Link href="/savedpapers?tab=highlights" className={`${styles.cta} ${styles.ctaPost}`}>
                                Post from your highlights
                            </Link>
                        ) : (
                            <Link href="/signup?next=/forum" className={styles.cta}>
                                Join to post and comment
                            </Link>
                        )}
                    </header>

                    <div className={styles.toolbar}>
                        {isLoggedIn ? (
                            <div className={styles.tabs} role="tablist" aria-label="Feed">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={feed === "latest"}
                                    onClick={() => go({ feed: "latest" })}
                                >
                                    Latest
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={feed === "following"}
                                    onClick={() => go({ feed: "following" })}
                                >
                                    Following
                                </button>
                            </div>
                        ) : (
                            <span />
                        )}
                        {(tags.length > 0 || tag) && (
                            <div className={styles.tagRow} aria-label="Topics">
                                {tag && (
                                    <button
                                        type="button"
                                        className={styles.tagActive}
                                        aria-label={`Clear topic ${tag}`}
                                        onClick={() => go({ tag: null })}
                                    >
                                        #{tag} ×
                                    </button>
                                )}
                                {tags
                                    .filter((item) => item.tag !== tag)
                                    .slice(0, 6)
                                    .map((item) => (
                                        <button
                                            key={item.tag}
                                            type="button"
                                            className={styles.tag}
                                            onClick={() => go({ tag: item.tag })}
                                        >
                                            #{item.tag}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {error && <p className={styles.notice} role="alert">{error}</p>}

                    {posts === null ? (
                        <div className={styles.feed} aria-busy="true">
                            {[0, 1, 2].map((item) => (
                                <div key={item} className={`${styles.post} ${styles.skeleton} loading-skeleton`} />
                            ))}
                        </div>
                    ) : posts.length === 0 ? (
                        <div className={styles.empty}>
                            <p className={styles.emptyTitle}>
                                {feed === "following" ? "Nothing from people you follow yet" : "No posts here yet"}
                            </p>
                            <p>
                                {feed === "following"
                                    ? "Follow researchers from their posts to fill this feed."
                                    : "Be the first: highlight a paper, then post it from Library → Highlights."}
                            </p>
                        </div>
                    ) : (
                        <div className={styles.feed}>
                            {posts.map((post) => (
                                <ForumPostCard
                                    key={post.id}
                                    post={post}
                                    signedIn={isLoggedIn}
                                    onDelete={() =>
                                        void send(`/api/forum/${post.id}`, "DELETE").then(() =>
                                            setPosts((current) => (current ?? []).filter((item) => item.id !== post.id)),
                                        )
                                    }
                                />
                            ))}
                            {nextBefore && (
                                <button type="button" className={styles.more} onClick={() => void load(nextBefore)}>
                                    Show older posts
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <aside className={styles.rail} aria-label="Forum guide">
                    {railTopics.length > 0 && (
                        <div className={`${styles.railCard} ${styles.railTopicsCard}`}>
                            <span className={styles.railTitle}>Topics</span>
                            <div className={styles.railTopics}>
                                {railTopics.map((item) => (
                                    <button
                                        key={item.tag}
                                        type="button"
                                        className={`${styles.railTopic} ${item.tag === tag ? styles.railTopicActive : ""}`}
                                        aria-pressed={item.tag === tag}
                                        onClick={() => go({ tag: item.tag === tag ? null : item.tag })}
                                    >
                                        #{item.tag}
                                        <span>{item.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className={`${styles.railCard} ${styles.railGroups}`}>
                        <span className={styles.railTitle}>Private groups</span>
                        <strong>Read with your lab</strong>
                        <span>Share papers and highlights where only members can see them.</span>
                        <Link href="/groups">Go to groups →</Link>
                    </div>
                    <div className={`${styles.railCard} ${styles.railSteps}`}>
                        <span className={styles.railTitle}>How posting works</span>
                        <ol>
                            <li>Highlight a paper while you read it.</li>
                            <li>In Library → Highlights, choose Post.</li>
                            <li>
                                Quotes show only when the paper&apos;s license allows it;
                                otherwise the post links to the spot.
                            </li>
                        </ol>
                    </div>
                </aside>
            </div>
        </main>
    );
}

export default function ForumPage() {
    return (
        <Suspense fallback={<main className={styles.page} aria-busy="true" />}>
            <Feed />
        </Suspense>
    );
}
