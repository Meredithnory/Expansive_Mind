"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { adminApi } from "../admin-api";
import { percentChange } from "../../lib/admin-overview";
import { formatDuration, mostActivePeople, type AudienceSummary } from "../../lib/audience";
import { guestName } from "../../lib/activity";
import type { FunnelStep, QuestionTopic } from "../../lib/admin-pulse";
import styles from "../admin-portal.module.scss";

/** Share times, brief opens, and brief sign-ups are recorded from this day on. */
const TRACKED_SINCE = "Sep 29, 2026";

type Pulse = {
    range: number;
    funnel: FunnelStep[];
    kpis: {
        newAccounts: number;
        priorNewAccounts: number;
        proAccounts: number;
        payingPro: number;
        listValue: number;
        aiCostUsd: number;
        priorAiCostUsd: number;
        discoveries: number;
    };
    today: { aiCostUsd: number; newMessages: number; openReports: number };
    topics: QuestionTopic[];
    newest: Array<{ question: string; createdAt: string; plan: string }>;
    quality: Array<{ id: string; label: string; detail: string; value: string; examples: string[] }>;
    sampled: boolean;
};

type Message = { _id: string; name: string; topic: string; message: string; createdAt: string };

const RANGES = [7, 30, 90];

type LimitPerson = {
    userId: string;
    name: string;
    email: string;
    plan: string;
    lastAt: string;
    features: Array<{ feature: string; label: string; used: number; limit: number; blocked: boolean }>;
};

const TOP_PEOPLE = 10;

function usageLine(usage: NonNullable<AudienceSummary["people"][number]["usage"]>) {
    const parts = [
        usage.discover ? `${usage.discover} ${usage.discover === 1 ? "discovery" : "discoveries"}` : "",
        usage.search ? `${usage.search} ${usage.search === 1 ? "search" : "searches"}` : "",
        usage.chat ? `${usage.chat} AI ${usage.chat === 1 ? "question" : "questions"}` : "",
    ].filter(Boolean);
    return parts.length ? `${parts.join(" · ")} this month` : "Nothing used yet this month";
}

/** Who spends the most time on the site, and what accounts used this month. */
function MostActiveCard({ audience }: { audience: AudienceSummary | null }) {
    const [everyone, setEveryone] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const ranked = audience ? mostActivePeople(audience.people, { includeGuests: everyone }) : [];
    const shown = showAll ? ranked : ranked.slice(0, TOP_PEOPLE);

    return (
        <section className={styles.card} aria-labelledby="active-h">
            <div className={styles.cardHead}>
                <div>
                    <h2 id="active-h">Most active people</h2>
                    <p className={styles.muted}>
                        Time on the site in the last 30 days. Accounts also show what they used this month.
                    </p>
                </div>
                <div role="radiogroup" aria-label="Show" className={clsx(styles.segmented, styles.segmentedSmall)}>
                    <button type="button" role="radio" aria-checked={!everyone} onClick={() => setEveryone(false)}>
                        Accounts
                    </button>
                    <button type="button" role="radio" aria-checked={everyone} onClick={() => setEveryone(true)}>
                        Everyone
                    </button>
                </div>
            </div>
            {!audience ? (
                <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
            ) : ranked.length === 0 ? (
                <p className={styles.muted}>{everyone ? "No visits recorded yet." : "No signed-in visits yet."}</p>
            ) : (
                <ol className={styles.plainList}>
                    {shown.map((person, index) => (
                        <li key={person.id} className={styles.activeRow}>
                            <span className={styles.activeRank}>{index + 1}</span>
                            <span className={styles.activeWho}>
                                <span className={styles.messageHead}>
                                    {person.email ? (
                                        <Link
                                            href={`/admin/people?q=${encodeURIComponent(person.email)}`}
                                            className={styles.personButton}
                                        >
                                            {person.name}
                                        </Link>
                                    ) : (
                                        <strong>{person.guest ? guestName(person.id) : person.name}</strong>
                                    )}
                                    <span className={clsx(styles.planChip, { [styles.planChipPro]: person.plan === "pro" })}>
                                        {person.guest ? "guest" : person.plan || "free"}
                                    </span>
                                </span>
                                <span className={styles.footnote}>
                                    {person.pages.length
                                        ? `Mostly ${person.pages.slice(0, 2).map((page) => page.label).join(" and ")}`
                                        : ""}
                                    {person.usage ? `${person.pages.length ? " · " : ""}${usageLine(person.usage)}` : ""}
                                </span>
                            </span>
                            <span className={styles.activeTime}>
                                <strong>{formatDuration(person.seconds)}</strong>
                                <small>
                                    {person.days.length} {person.days.length === 1 ? "day" : "days"}
                                </small>
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            {ranked.length > TOP_PEOPLE ? (
                <button type="button" className={styles.textButton} onClick={() => setShowAll((value) => !value)}>
                    {showAll ? `Show the top ${TOP_PEOPLE}` : `Show all ${ranked.length}`}
                </button>
            ) : null}
        </section>
    );
}

/** Who used up a monthly allowance; each also emailed Meredith the first time. */
function HitLimitCard() {
    const [data, setData] = useState<{ month: string; people: LimitPerson[] } | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        adminApi<{ month: string; people: LimitPerson[] }>("/api/admin/limits")
            .then(setData)
            .catch((err) => setError(err instanceof Error ? err.message : "Unable to load limits."));
    }, []);

    return (
        <section className={styles.card} aria-labelledby="limits-h">
            <div className={styles.cardHead}>
                <div>
                    <h2 id="limits-h">
                        Hit a limit this month{" "}
                        {data && data.people.length > 0 ? (
                            <span className={styles.liveCount}>{data.people.length}</span>
                        ) : null}
                    </h2>
                    <p className={styles.muted}>
                        People who used all their discoveries, paper searches, or AI paper questions
                        {data ? ` in ${data.month}` : " this month"}. You also get an email the first time.
                    </p>
                </div>
                <Link href="/admin/people" className={styles.textLink}>
                    People &amp; support
                </Link>
            </div>
            {error ? (
                <p className={styles.error}>{error}</p>
            ) : !data ? (
                <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
            ) : data.people.length === 0 ? (
                <p className={styles.muted}>Nobody has hit a limit this month.</p>
            ) : (
                <ul className={styles.plainList}>
                    {data.people.map((person) => (
                        <li key={person.userId} className={styles.limitRow}>
                            <div className={styles.messageHead}>
                                <Link
                                    href={`/admin/people?q=${encodeURIComponent(person.email)}`}
                                    className={styles.personButton}
                                >
                                    {person.name}
                                </Link>
                                <span className={clsx(styles.planChip, { [styles.planChipPro]: person.plan === "pro" })}>
                                    {person.plan}
                                </span>
                                <span className={styles.when}>{ago(person.lastAt)}</span>
                            </div>
                            <span className={styles.footnote}>{person.email}</span>
                            <div className={styles.chips}>
                                {person.features.map((item) => (
                                    <span key={item.feature} className={styles.chip}>
                                        {item.label}: {item.used} of {item.limit}
                                        {item.blocked ? " · tried again" : ""}
                                    </span>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <p className={styles.footnote}>
                To give someone more, open them in People &amp; support and reset their usage.
            </p>
        </section>
    );
}

function ago(date: string) {
    const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

/** "$0", "$0.042", "$12.40": small AI costs keep their cents. */
function money(value: number) {
    if (!value) return "$0";
    return value < 1 ? `$${value.toFixed(3)}` : `$${value.toFixed(2)}`;
}

function Change({ current, prior }: { current: number; prior: number }) {
    const change = percentChange(current, prior);
    if (change == null) return <span className={styles.kpiNote}>No earlier period to compare</span>;
    return (
        <span className={styles.kpiNote}>
            {change > 0 ? "+" : ""}
            {change.toFixed(0)}% vs the period before
        </span>
    );
}

export default function AdminPulsePage() {
    const [range, setRange] = useState(30);
    const [pulse, setPulse] = useState<Pulse | null>(null);
    const [error, setError] = useState("");
    const [ask, setAsk] = useState<"topics" | "questions">("topics");
    const [messages, setMessages] = useState<Message[]>([]);
    const [audience, setAudience] = useState<AudienceSummary | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError("");
        adminApi<Pulse>(`/api/admin/pulse?range=${range}`)
            .then((data) => !cancelled && setPulse(data))
            .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Unable to load the pulse."));
        return () => {
            cancelled = true;
        };
    }, [range]);

    useEffect(() => {
        adminApi<{ messages: Message[] }>("/api/admin/feedback?status=new")
            .then((data) => setMessages(data.messages.slice(0, 3)))
            .catch(() => undefined);
        adminApi<AudienceSummary>("/api/admin/audience")
            .then(setAudience)
            .catch(() => undefined);
    }, []);

    const kpis = pulse?.kpis;

    return (
        <main className={styles.main}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Product pulse</h1>
                    <p className={styles.lead}>
                        How people move from a question to a shared brief, and where they stop.
                    </p>
                </div>
                <div role="radiogroup" aria-label="Time range" className={styles.segmented}>
                    {RANGES.map((days) => (
                        <button
                            key={days}
                            type="button"
                            role="radio"
                            aria-checked={range === days}
                            onClick={() => setRange(days)}
                        >
                            {days} days
                        </button>
                    ))}
                </div>
            </header>

            {error ? <p className={styles.error}>{error}</p> : null}

            {pulse ? (
                <section className={styles.today} aria-label="What needs you">
                    <Link href="/admin/feedback" className={styles.todayItem}>
                        <span>
                            <strong>Feedback inbox</strong>
                            <small>New contact messages</small>
                        </span>
                        <b>{pulse.today.newMessages}</b>
                    </Link>
                    <Link href="/admin/reports" className={styles.todayItem}>
                        <span>
                            <strong>Forum reports</strong>
                            <small>Waiting for a decision</small>
                        </span>
                        <b>{pulse.today.openReports}</b>
                    </Link>
                    <Link href="/admin/usage" className={styles.todayItem}>
                        <span>
                            <strong>AI cost today</strong>
                            <small>Since midnight UTC</small>
                        </span>
                        <b>{money(pulse.today.aiCostUsd)}</b>
                    </Link>
                </section>
            ) : null}

            <HitLimitCard />

            <section className={clsx(styles.card, styles.funnelCard)} aria-labelledby="funnel-h">
                <div className={styles.cardHead}>
                    <div>
                        <h2 id="funnel-h">From a question to a shared brief</h2>
                        <p className={styles.muted}>
                            The launch goal, step by step. Each arrow is the share of people who
                            made it to the next step.
                        </p>
                    </div>
                </div>
                {pulse ? (
                    <ol className={styles.funnel}>
                        {pulse.funnel.map((step) => (
                            <li key={step.id} className={clsx(styles.funnelStep, { [styles.funnelStepKey]: step.id === "shared" })}>
                                {step.rate !== null ? (
                                    <span className={styles.funnelRate} aria-label={`${step.rate}% of the step before`}>
                                        {step.rate}% →
                                    </span>
                                ) : null}
                                <span className={styles.funnelLabel}>{step.label}</span>
                                <span className={styles.funnelCount}>{step.count.toLocaleString()}</span>
                                <span className={styles.funnelDetail}>{step.detail}</span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                )}
                <p className={styles.footnote}>
                    Shares, brief opens, and sign-ups from a brief are counted from {TRACKED_SINCE}.
                </p>
            </section>

            <div className={styles.kpiGrid}>
                <div className={styles.kpi}>
                    <span>New accounts</span>
                    <strong>{kpis ? kpis.newAccounts.toLocaleString() : "—"}</strong>
                    {kpis ? <Change current={kpis.newAccounts} prior={kpis.priorNewAccounts} /> : null}
                </div>
                <div className={styles.kpi}>
                    <span>Pro accounts</span>
                    <strong>{kpis ? kpis.proAccounts.toLocaleString() : "—"}</strong>
                    {kpis ? <span className={styles.kpiNote}>{kpis.payingPro} paying, the rest complimentary</span> : null}
                </div>
                <div className={styles.kpi}>
                    <span>AI cost</span>
                    <strong>{kpis ? money(kpis.aiCostUsd) : "—"}</strong>
                    {kpis ? (
                        <span className={styles.kpiNote}>
                            {kpis.discoveries
                                ? `${money(kpis.aiCostUsd / kpis.discoveries)} per discovery`
                                : "No discoveries in this period"}
                        </span>
                    ) : null}
                </div>
                <div className={styles.kpi}>
                    <span>Paid plans, list value</span>
                    <strong>{kpis ? `$${Math.round(kpis.listValue).toLocaleString()} / mo` : "—"}</strong>
                    <span className={styles.kpiNote}>Paying Pro accounts × monthly price</span>
                </div>
            </div>

            <MostActiveCard audience={audience} />

            <div className={styles.twoUp}>
                <section className={styles.card} aria-labelledby="asking-h">
                    <div className={styles.cardHead}>
                        <h2 id="asking-h">What people are asking</h2>
                        <div role="radiogroup" aria-label="Show" className={clsx(styles.segmented, styles.segmentedSmall)}>
                            <button type="button" role="radio" aria-checked={ask === "topics"} onClick={() => setAsk("topics")}>
                                Topics
                            </button>
                            <button type="button" role="radio" aria-checked={ask === "questions"} onClick={() => setAsk("questions")}>
                                Newest questions
                            </button>
                        </div>
                    </div>
                    {!pulse ? (
                        <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                    ) : ask === "topics" ? (
                        pulse.topics.length === 0 ? (
                            <p className={styles.muted}>No questions in this period yet.</p>
                        ) : (
                            <div role="table" aria-label="Topics" className={styles.topicTable}>
                                <div role="row" className={styles.topicHead}>
                                    <span role="columnheader">Topic</span>
                                    <span role="columnheader">Runs</span>
                                    <span role="columnheader">Shared</span>
                                    <span role="columnheader">Before</span>
                                </div>
                                {pulse.topics.map((topic) => (
                                    <div role="row" key={topic.topic} className={styles.topicRow}>
                                        <span role="cell">{topic.topic}</span>
                                        <span role="cell">{topic.runs}</span>
                                        <span role="cell">{topic.shared}</span>
                                        <span role="cell">{topic.prior}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <ul className={styles.plainList}>
                            {pulse.newest.map((item, index) => (
                                <li key={`${item.createdAt}-${index}`} className={styles.questionRow}>
                                    <span className={styles.questionText}>{item.question}</span>
                                    <span className={styles.planChip}>{item.plan}</span>
                                    <span className={styles.when}>{ago(item.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className={styles.footnote}>
                        Saved and guest discovery questions, grouped by the words people use.
                        {pulse?.sampled ? " Quality numbers read the latest 400 runs." : ""}
                    </p>
                </section>

                <section className={styles.card} aria-labelledby="short-h">
                    <div className={styles.cardHead}>
                        <h2 id="short-h">Where runs fall short</h2>
                    </div>
                    {!pulse ? (
                        <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                    ) : (
                        <ul className={styles.plainList}>
                            {pulse.quality.map((item) => (
                                <li key={item.id} className={styles.qualityRow}>
                                    <details>
                                        <summary>
                                            <span className={styles.qualityText}>
                                                <strong>{item.label}</strong>
                                                <small>{item.detail}</small>
                                            </span>
                                            <b>{item.value}</b>
                                        </summary>
                                        {item.examples.length > 0 ? (
                                            <ul className={styles.examples}>
                                                {item.examples.map((example, index) => (
                                                    <li key={index}>{example}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className={styles.muted}>No example runs to show.</p>
                                        )}
                                    </details>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <div className={styles.twoUp}>
                <section className={styles.card} aria-labelledby="inbox-h">
                    <div className={styles.cardHead}>
                        <h2 id="inbox-h">Feedback inbox</h2>
                        <Link href="/admin/feedback" className={styles.textLink}>
                            Open inbox
                        </Link>
                    </div>
                    {messages.length === 0 ? (
                        <p className={styles.muted}>No new messages.</p>
                    ) : (
                        <ul className={styles.plainList}>
                            {messages.map((message) => (
                                <li key={message._id} className={styles.messagePreview}>
                                    <span className={styles.messageHead}>
                                        <span className={styles.topicChip}>{message.topic}</span>
                                        <strong>{message.name}</strong>
                                        <span className={styles.when}>{ago(message.createdAt)}</span>
                                    </span>
                                    <span className={styles.messageSnippet}>{message.message}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className={styles.card} aria-labelledby="time-h">
                    <div className={styles.cardHead}>
                        <h2 id="time-h">Where time goes</h2>
                        <span className={styles.footnote}>Last 30 days</span>
                    </div>
                    {!audience ? (
                        <div className={clsx(styles.skeletonBlock, "loading-skeleton")} />
                    ) : audience.pages.length === 0 && audience.destinations.length === 0 ? (
                        <p className={styles.muted}>No visits recorded yet.</p>
                    ) : (
                        <ul className={styles.plainList}>
                            {audience.pages.slice(0, 5).map((page) => (
                                <li key={page.page} className={styles.timeRow}>
                                    <span>{page.label}</span>
                                    <span className={styles.muted}>
                                        {formatDuration(page.seconds)} · {page.visitors}{" "}
                                        {page.visitors === 1 ? "person" : "people"}
                                    </span>
                                </li>
                            ))}
                            {audience.destinations.slice(0, 3).map((move) => (
                                <li key={`${move.from}-${move.to}`} className={styles.timeRow}>
                                    <span>{move.label}</span>
                                    <span className={styles.muted}>
                                        {move.count} {move.count === 1 ? "move" : "moves"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <span className={styles.footnote}>
                        {audience ? `${audience.visitors} visitors, ${audience.signedInVisitors} signed in.` : ""}
                    </span>
                </section>
            </div>
        </main>
    );
}
