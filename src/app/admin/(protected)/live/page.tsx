"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { adminApi } from "../../admin-api";
import { formatDuration } from "../../../lib/audience";
import type { FeedHours, FeedItem } from "../../../lib/activity";
import styles from "../../admin-portal.module.scss";

type LivePerson = {
    person: string;
    who: string;
    plan: string;
    page: string;
    pageLabel: string;
    path: string | null;
    lastSeenAt: string;
    secondsToday: number;
};

type LiveData = {
    now: string;
    hours: FeedHours;
    live: LivePerson[];
    feed: FeedItem[];
    personName: string | null;
};

const REFRESH_MS = 10_000;

const HOURS: Array<{ hours: FeedHours; label: string }> = [
    { hours: 1, label: "Last hour" },
    { hours: 24, label: "24 hours" },
    { hours: 168, label: "7 days" },
];

function ago(date: string, now: string) {
    const seconds = Math.max(0, Math.round((new Date(now).getTime() - new Date(date).getTime()) / 1_000));
    if (seconds < 60) return seconds < 5 ? "now" : `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

/** Paper and brief paths say which one; "/discover" says nothing the label doesn't. */
function showsPath(path?: string | null): path is string {
    return Boolean(path && path.split("/").filter(Boolean).length > 1);
}

function PlanChip({ plan }: { plan: string }) {
    return <span className={clsx(styles.planChip, { [styles.planChipPro]: plan === "pro" })}>{plan}</span>;
}

export default function AdminLivePage() {
    const [hours, setHours] = useState<FeedHours>(24);
    const [actionsOnly, setActionsOnly] = useState(false);
    const [person, setPerson] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);
    const [data, setData] = useState<LiveData | null>(null);
    const [error, setError] = useState("");
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    const url = `/api/admin/live?hours=${hours}${actionsOnly ? "&actions=1" : ""}${
        person ? `&person=${encodeURIComponent(person)}` : ""
    }`;

    useEffect(() => setData(null), [url]);

    useEffect(() => {
        let cancelled = false;
        const load = () =>
            adminApi<LiveData>(url)
                .then((next) => {
                    if (cancelled) return;
                    setData(next);
                    setError("");
                    setUpdatedAt(new Date());
                })
                .catch((err) => {
                    if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load live activity.");
                });
        load();
        const timer = paused
            ? undefined
            : window.setInterval(() => {
                  if (document.visibilityState === "visible") load();
              }, REFRESH_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [url, paused]);

    const showPerson = (ref: string) => {
        if (!ref) return;
        setPerson(ref);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <main className={styles.main}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Live</h1>
                    <p className={styles.lead}>
                        Who is on the site right now, and the steps people took. Click a name to follow one person.
                    </p>
                </div>
                <div className={styles.liveControls}>
                    <span className={styles.liveStatus} aria-live="polite">
                        <span className={clsx(styles.liveDot, { [styles.liveDotPaused]: paused })} aria-hidden="true" />
                        {paused
                            ? "Paused"
                            : updatedAt
                              ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
                              : "Connecting…"}
                    </span>
                    <button type="button" className={styles.actionButton} onClick={() => setPaused((value) => !value)}>
                        {paused ? "Resume" : "Pause"}
                    </button>
                </div>
            </header>

            {error ? <p className={styles.error}>{error}</p> : null}

            <section className={styles.card} aria-labelledby="now-h">
                <div className={styles.cardHead}>
                    <h2 id="now-h">
                        On the site now{" "}
                        {data ? <span className={styles.liveCount}>{data.live.length}</span> : null}
                    </h2>
                    <span className={styles.footnote}>Updates every 10 seconds</span>
                </div>
                {!data ? (
                    <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                ) : data.live.length === 0 ? (
                    <p className={styles.muted}>Nobody is on the site right now.</p>
                ) : (
                    <ul className={styles.plainList}>
                        {data.live.map((row) => (
                            <li key={row.person} className={styles.liveRow}>
                                <span className={styles.liveDot} aria-hidden="true" />
                                <span className={styles.liveWho}>
                                    <button type="button" className={styles.personButton} onClick={() => showPerson(row.person)}>
                                        {row.who}
                                    </button>
                                    <PlanChip plan={row.plan} />
                                </span>
                                <span className={styles.liveWhere}>
                                    <strong>{row.pageLabel}</strong>
                                    {showsPath(row.path) ? <small>{row.path}</small> : null}
                                </span>
                                <span className={styles.when}>{formatDuration(row.secondsToday)} today</span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className={styles.footnote}>
                    Someone shows here while the site is open in front of them, and drops off within a minute of leaving.
                </p>
            </section>

            <section className={styles.card} aria-labelledby="feed-h">
                <div className={styles.cardHead}>
                    <h2 id="feed-h">What people are doing</h2>
                    <div className={styles.liveFilters}>
                        <div role="radiogroup" aria-label="Period" className={clsx(styles.segmented, styles.segmentedSmall)}>
                            {HOURS.map((option) => (
                                <button
                                    key={option.hours}
                                    type="button"
                                    role="radio"
                                    aria-checked={hours === option.hours}
                                    onClick={() => setHours(option.hours)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div role="radiogroup" aria-label="Show" className={clsx(styles.segmented, styles.segmentedSmall)}>
                            <button type="button" role="radio" aria-checked={!actionsOnly} onClick={() => setActionsOnly(false)}>
                                Everything
                            </button>
                            <button type="button" role="radio" aria-checked={actionsOnly} onClick={() => setActionsOnly(true)}>
                                Actions only
                            </button>
                        </div>
                    </div>
                </div>

                {person ? (
                    <div className={styles.personBar}>
                        <span>
                            Steps for <strong>{data?.personName ?? "this person"}</strong>, newest first
                        </span>
                        <button type="button" className={styles.textButton} onClick={() => setPerson(null)}>
                            Show everyone
                        </button>
                    </div>
                ) : null}

                {!data ? (
                    <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                ) : data.feed.length === 0 ? (
                    <p className={styles.muted}>Nothing in this period yet.</p>
                ) : (
                    <ul className={styles.plainList}>
                        {data.feed.map((item) => (
                            <li key={item.id} className={styles.feedRow}>
                                <span className={styles.feedWhen}>{ago(item.at, data.now)}</span>
                                <span className={styles.feedBody}>
                                    <span className={styles.feedLine}>
                                        {person ? (
                                            <strong className={styles.feedWho}>{item.who}</strong>
                                        ) : (
                                            <button type="button" className={styles.personButton} onClick={() => showPerson(item.person)}>
                                                {item.who}
                                            </button>
                                        )}
                                        <PlanChip plan={item.plan} />
                                        <span className={styles.feedText} data-kind={item.kind} data-score={item.score}>
                                            {item.text}
                                        </span>
                                    </span>
                                    {item.detail ? (
                                        <span className={styles.feedDetail}>
                                            {item.kind === "signup" ? item.detail : `“${item.detail}”`}
                                        </span>
                                    ) : null}
                                    {item.context ? <span className={styles.feedContext}>About: {item.context}</span> : null}
                                    {showsPath(item.path) ? (
                                        <a href={item.path} target="_blank" rel="noreferrer" className={styles.feedPath}>
                                            {item.path}
                                        </a>
                                    ) : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className={styles.footnote}>
                    Page views, discoveries, and searches are kept for 30 days. Guests show as a short code, never who
                    they are. Shows the latest 150 steps.
                </p>
            </section>
        </main>
    );
}
