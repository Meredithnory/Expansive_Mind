"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ForumPostCard from "../forum/ForumPostCard";
import { type ForumPost, send } from "../forum/forum-client";
import { EMPTY_BADGE, badgeTagLine, describeOutfit } from "../lib/lab-badge";
import { NEWSLETTER_OPT_IN_VISIBLE } from "../lib/newsletter";
import { coatColor } from "../lib/profile-colors";
import { useSession } from "../lib/use-session";
import BadgeStage, { tagName } from "./BadgeStage";
import ProductEmailToggle from "./ProductEmailToggle";
import styles from "./profile.module.scss";

type Stats = { posts: number; followers: number; following: number };
type GroupRow = { id: string; name: string; role: string; memberCount: number };
type Tab = "posts" | "highlights" | "groups";

export default function ProfilePage() {
    const { user } = useSession();
    const [stats, setStats] = useState<Stats | null>(null);
    const [posts, setPosts] = useState<ForumPost[] | null>(null);
    const [groups, setGroups] = useState<GroupRow[] | null>(null);
    const [tab, setTab] = useState<Tab>("posts");
    const userId = user?.id ? String(user.id) : "";

    const load = useCallback(async () => {
        if (!userId) return;
        const [personResponse, postsResponse, groupsResponse] = await Promise.all([
            fetch(`/api/forum/people/${userId}`, { cache: "no-store" }),
            fetch(`/api/forum?author=${userId}`, { cache: "no-store" }),
            fetch("/api/groups", { cache: "no-store" }),
        ]);
        const person = await personResponse.json().catch(() => ({}));
        const feed = await postsResponse.json().catch(() => ({}));
        const groupList = await groupsResponse.json().catch(() => ({}));
        if (person.person) {
            setStats({
                posts: person.person.posts ?? 0,
                followers: person.person.followers ?? 0,
                following: person.person.following ?? 0,
            });
        }
        setPosts(Array.isArray(feed.posts) ? feed.posts : []);
        setGroups(Array.isArray(groupList.groups) ? groupList.groups : []);
    }, [userId]);

    useEffect(() => {
        void load();
    }, [load]);

    if (!user) {
        return <main className={styles.page} aria-busy="true" />;
    }

    const badge = user.badge ?? EMPTY_BADGE;
    const name = tagName(user.firstName, user.lastName);
    const tagLine = badgeTagLine(badge);
    const coat = coatColor(user.profileColor);
    const highlights = (posts ?? []).flatMap((post) =>
        post.highlights.map((highlight) => ({ ...highlight, paperTitle: post.paper.title })),
    );
    const tabs: Array<{ id: Tab; label: string }> = [
        { id: "posts", label: posts ? `Posts · ${posts.length}` : "Posts" },
        { id: "highlights", label: posts ? `Highlights · ${highlights.length}` : "Highlights" },
        { id: "groups", label: groups ? `Groups · ${groups.length}` : "Groups" },
    ];

    return (
        <main className={styles.page}>
            <section className={styles.hero} aria-labelledby="profile-name">
                <div className={styles.heroStrip} style={{ background: coat.hex }} aria-hidden="true" />
                <div className={styles.heroStage}>
                    <BadgeStage color={user.profileColor} badge={badge} label={`${name}'s character`} />
                </div>
                <div className={styles.heroInfo}>
                    <span className={styles.eyebrow}>Expansive Mind · Member</span>
                    <h1 id="profile-name">{name}</h1>
                    {tagLine ? (
                        <p className={styles.tagLine}>{tagLine}</p>
                    ) : (
                        <Link href="/profile/badge?tab=tag" className={styles.addLink}>
                            Add your role and field
                        </Link>
                    )}
                    <dl className={styles.stats}>
                        <div>
                            <dt>Posts</dt>
                            <dd>{stats?.posts ?? "–"}</dd>
                        </div>
                        <div>
                            <dt>Followers</dt>
                            <dd>{stats?.followers ?? "–"}</dd>
                        </div>
                        <div>
                            <dt>Following</dt>
                            <dd>{stats?.following ?? "–"}</dd>
                        </div>
                    </dl>
                </div>
                <div className={styles.heroActions}>
                    <Link href="/profile/badge" className={styles.primaryButton}>
                        Edit badge
                    </Link>
                    <Link href={`/forum/people/${userId}`} className={styles.secondaryButton}>
                        View public profile
                    </Link>
                </div>
            </section>

            <div className={styles.columns}>
                <div className={styles.sideColumn}>
                    <section className={styles.panel} aria-labelledby="about-heading">
                        <h2 id="about-heading">About</h2>
                        {user.bio ? (
                            <p className={styles.bio}>{user.bio}</p>
                        ) : (
                            <div className={styles.emptyBox}>
                                <p>Add a short bio so people know what you work on and what you&apos;re reading.</p>
                                <Link href="/profile/badge?tab=tag">Add a bio</Link>
                            </div>
                        )}
                        <div className={styles.detail}>
                            <span className={styles.detailLabel}>Badge</span>
                            <span>{describeOutfit(coat.label, badge)}</span>
                        </div>
                    </section>

                    <section className={`${styles.panel} ${styles.accountPanel}`} aria-labelledby="account-heading">
                        <div className={styles.panelHeader}>
                            <h2 id="account-heading">Account</h2>
                            <span className={styles.private}>Only you see this</span>
                        </div>
                        <div className={styles.detail}>
                            <span className={styles.detailLabel}>Email</span>
                            <span>{user.email}</span>
                        </div>
                        <div className={styles.detail}>
                            <span className={styles.detailLabel}>Plan</span>
                            <span>{user.plan === "pro" ? "Researcher Pro" : "Free"}</span>
                        </div>
                        {NEWSLETTER_OPT_IN_VISIBLE && <ProductEmailToggle />}
                        <nav className={styles.accountLinks} aria-label="Account">
                            <Link href="/pricing">
                                Plan and billing <span aria-hidden="true">›</span>
                            </Link>
                            <Link href="/forgot-password">
                                Reset password <span aria-hidden="true">›</span>
                            </Link>
                        </nav>
                    </section>
                </div>

                <section className={`${styles.panel} ${styles.activity}`} aria-label="Your activity">
                    <div className={styles.tabs} role="tablist" aria-label="Your activity">
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === item.id}
                                className={tab === item.id ? styles.tabActive : styles.tab}
                                onClick={() => setTab(item.id)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {tab === "posts" &&
                        (posts === null ? (
                            <p className={styles.muted}>Loading your posts…</p>
                        ) : posts.length === 0 ? (
                            <div className={styles.emptyBox}>
                                <p>You haven&apos;t posted to the forum yet.</p>
                                <Link href="/savedpapers?tab=highlights">Post a paper from your highlights</Link>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {posts.map((post) => (
                                    <ForumPostCard
                                        key={post.id}
                                        post={post}
                                        signedIn
                                        onDelete={() => void send(`/api/forum/${post.id}`, "DELETE").then(load)}
                                    />
                                ))}
                            </div>
                        ))}

                    {tab === "highlights" &&
                        (posts === null ? (
                            <p className={styles.muted}>Loading your highlights…</p>
                        ) : highlights.length === 0 ? (
                            <div className={styles.emptyBox}>
                                <p>Highlights you share in forum posts show up here.</p>
                                <Link href="/savedpapers?tab=highlights">Go to your highlights</Link>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {highlights.map((highlight) => (
                                    <article key={highlight.id} className={styles.highlight}>
                                        <span className={styles.highlightPaper}>{highlight.paperTitle}</span>
                                        {highlight.excerpt ? (
                                            <blockquote>{highlight.excerpt}</blockquote>
                                        ) : (
                                            <p className={styles.muted}>
                                                Highlight in {highlight.sectionTitle}. This paper&apos;s license
                                                doesn&apos;t allow sharing its text, so open it to read.
                                            </p>
                                        )}
                                        <Link href={highlight.href}>Open in paper →</Link>
                                    </article>
                                ))}
                            </div>
                        ))}

                    {tab === "groups" &&
                        (groups === null ? (
                            <p className={styles.muted}>Loading your groups…</p>
                        ) : groups.length === 0 ? (
                            <div className={styles.emptyBox}>
                                <p>Groups are where a lab or journal club reads papers together.</p>
                                <Link href="/groups">Browse groups</Link>
                            </div>
                        ) : (
                            <ul className={styles.groupList}>
                                {groups.map((group) => (
                                    <li key={group.id}>
                                        <Link href={`/groups/${group.id}`}>{group.name}</Link>
                                        <span className={styles.muted}>
                                            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                                            {group.role === "owner" ? " · You run it" : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                </section>
            </div>
        </main>
    );
}
