"use client";

import { useEffect, useMemo, useState } from "react";
import { areaPath, chartPolyline } from "../lib/admin-overview";
import {
    formatDuration,
    type AudienceSummary,
} from "../lib/audience";
import styles from "./admin.module.scss";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = 28;

const PAGE_COLORS: Record<string, string> = {
    discover: "#ff168f",
    search: "#0ab1ff",
    paper: "#f4d98a",
    library: "#3dd6c6",
    projects: "#ff8a4c",
    pricing: "#b45cff",
    home: "#d7ebff",
    account: "#8b8b96",
    company: "#7dd3fc",
    start: "#9ef0c3",
};

function pageColor(page: string) {
    return PAGE_COLORS[page] || "#c8c8d0";
}

function countLabel(count: number, singular: string) {
    return `${count.toLocaleString()} ${count === 1 ? singular : `${singular}s`}`;
}

export function AudiencePanel() {
    const [summary, setSummary] = useState<AudienceSummary | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/admin/audience", { cache: "no-store" })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Unable to load audience.");
                return data as AudienceSummary;
            })
            .then((data) => {
                if (!cancelled) setSummary(data);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Unable to load audience.");
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) return <section className={styles.panel}><p className={styles.error}>{error}</p></section>;
    if (!summary) {
        return <section className={styles.panel}><p className={styles.muted}>Loading audience…</p></section>;
    }

    const average = summary.visitors ? summary.seconds / summary.visitors : 0;
    const topPage = summary.pages[0];
    const topMove = summary.destinations[0];

    return (
        <section className={styles.panel}>
            <div className={styles.overviewHead}>
                <div>
                    <p className={styles.eyebrow}>Audience</p>
                    <h2>Last {summary.rangeDays} days</h2>
                </div>
                <p>
                    Days people showed up, how long they stayed, and which
                    pages they opened next. The admin portal itself is not counted.
                </p>
            </div>
            <div className={`${styles.kpiGrid} ${styles.kpiGridFour}`}>
                <article>
                    <span>Visitors</span>
                    <strong>{summary.visitors.toLocaleString()}</strong>
                    <small className={styles.deltaMuted}>
                        {summary.signedInVisitors.toLocaleString()} signed in
                    </small>
                </article>
                <article>
                    <span>Avg time</span>
                    <strong>{formatDuration(average)}</strong>
                    <small className={styles.deltaMuted}>
                        {formatDuration(summary.seconds)} total
                    </small>
                </article>
                <article>
                    <span>Looked at most</span>
                    <strong>{topPage?.label || "—"}</strong>
                    <small className={styles.deltaMuted}>
                        {topPage
                            ? `${formatDuration(topPage.seconds)} · ${countLabel(topPage.visitors, "visitor")}`
                            : "No page time yet"}
                    </small>
                </article>
                <article>
                    <span>Went next</span>
                    <strong>{topMove?.label || "—"}</strong>
                    <small className={styles.deltaMuted}>
                        {topMove ? countLabel(topMove.count, "move") : "No path changes yet"}
                    </small>
                </article>
            </div>
            <DailyAudience daily={summary.daily} />
            <div className={styles.chartGrid}>
                <BarList
                    title="What they looked at"
                    caption="Time spent on each page"
                    rows={summary.pages.map((page) => ({
                        key: page.page,
                        label: page.label,
                        detail: `${formatDuration(page.seconds)} · ${countLabel(page.visitors, "visitor")}`,
                        value: page.seconds,
                        color: pageColor(page.page),
                    }))}
                    empty="No page time yet. It appears after someone spends a few seconds on the site."
                />
                <BarList
                    title="Where they went"
                    caption="Next page after the one they were on"
                    rows={summary.destinations.map((move) => ({
                        key: move.label,
                        label: move.label,
                        detail: countLabel(move.count, "move"),
                        value: move.count,
                        color: pageColor(move.to),
                    }))}
                    empty="Path changes appear when someone opens another page."
                />
            </div>
            <PeopleTable people={summary.people} />
            <BarList
                title="How many days they came back"
                caption="Distinct days each visitor was on the site"
                rows={summary.returnDays.map((bucket) => ({
                    key: bucket.label,
                    label: bucket.label,
                    detail: countLabel(bucket.visitors, "visitor"),
                    value: bucket.visitors,
                    color: "#ff168f",
                }))}
                empty="No return pattern yet."
            />
        </section>
    );
}

function formatDay(day: string) {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

function PeopleTable({ people }: { people: AudienceSummary["people"] }) {
    const [openId, setOpenId] = useState<string | null>(null);
    return (
        <div className={styles.tableWrap}>
            <div className={styles.overviewHead}>
                <div>
                    <p className={styles.eyebrow}>People</p>
                    <h2>Who showed up</h2>
                </div>
                <p>
                    Signed-in visits are tied to the account. Guests stay
                    anonymous until they log in on that browser.
                </p>
            </div>
            {people.length === 0 ? (
                <p className={styles.muted}>No visitors in this window.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Person</th>
                            <th>Account</th>
                            <th>Days</th>
                            <th>Time</th>
                            <th>Looked at most</th>
                        </tr>
                    </thead>
                    <tbody>
                        {people.map((person) => {
                            const open = openId === person.id;
                            return (
                                <tr key={person.id}>
                                    <td>
                                        <button
                                            type="button"
                                            className={styles.personButton}
                                            aria-expanded={open}
                                            onClick={() =>
                                                setOpenId(open ? null : person.id)
                                            }
                                        >
                                            <strong>{person.name}</strong>
                                            <span className={styles.muted}>
                                                {person.email || "No account"}
                                            </span>
                                        </button>
                                        {open ? (
                                            <div className={styles.personDetail}>
                                                <span>
                                                    {person.days.map(formatDay).join(", ")}
                                                </span>
                                                {person.pages.map((page) => (
                                                    <span key={page.page}>
                                                        {page.label} · {formatDuration(page.seconds)}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td>
                                        {person.guest
                                            ? "Guest"
                                            : person.plan
                                              ? person.plan[0].toUpperCase() + person.plan.slice(1)
                                              : "Account"}
                                    </td>
                                    <td>{countLabel(person.days.length, "day")}</td>
                                    <td>{formatDuration(person.seconds)}</td>
                                    <td>{person.pages[0]?.label || "—"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function DailyAudience({ daily }: { daily: AudienceSummary["daily"] }) {
    const [hover, setHover] = useState<number | null>(null);
    const visitors = daily.map((row) => row.visitors);
    const minutes = daily.map((row) => row.seconds / 60);
    const area = useMemo(() => areaPath(visitors, WIDTH, HEIGHT, PAD), [visitors]);
    const volume = useMemo(() => chartPolyline(minutes, WIDTH, HEIGHT, PAD), [minutes]);
    const active = hover == null ? null : daily[hover];
    const hasActivity = daily.some((row) => row.visitors > 0);

    return (
        <figure className={`${styles.chartBlock} ${styles.audienceChart}`}>
            <figcaption>
                <div>
                    <h2>Days on the site</h2>
                    <p>Visitors each day, with time spent as the dashed line</p>
                </div>
                {active ? (
                    <div className={styles.chartTip} role="status">
                        <strong>
                            {new Date(`${active.date}T00:00:00Z`).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                            )}
                        </strong>
                        <span>
                            {active.visitors.toLocaleString()} visitors ·{" "}
                            {formatDuration(active.seconds)}
                        </span>
                    </div>
                ) : (
                    <div className={styles.chartLegend}>
                        <span data-tone="cost">Visitors</span>
                        <span data-tone="volume">Time</span>
                    </div>
                )}
            </figcaption>
            {hasActivity ? (
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    role="img"
                    aria-label="Daily visitors and time spent for the last 30 days"
                    onMouseLeave={() => setHover(null)}
                    onMouseMove={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
                        const index = Math.round(
                            ((x - PAD) / Math.max(WIDTH - PAD * 2, 1)) * (daily.length - 1),
                        );
                        setHover(Math.min(daily.length - 1, Math.max(0, index)));
                    }}
                >
                    <path d={area} className={styles.chartArea} />
                    <path d={volume} className={styles.chartVolume} fill="none" />
                    <text x={PAD} y={16} className={styles.chartAxis}>
                        {Math.max(...visitors)} visitors
                    </text>
                    <text x={WIDTH - PAD} y={16} textAnchor="end" className={styles.chartAxis}>
                        {Math.round(Math.max(...minutes))}m
                    </text>
                </svg>
            ) : (
                <p className={styles.emptyChart}>
                    No visits in this window yet.
                </p>
            )}
        </figure>
    );
}

function BarList({
    title,
    caption,
    rows,
    empty,
}: {
    title: string;
    caption: string;
    rows: Array<{
        key: string;
        label: string;
        detail: string;
        value: number;
        color: string;
    }>;
    empty: string;
}) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return (
        <figure className={styles.chartBlock}>
            <figcaption>
                <div>
                    <h2>{title}</h2>
                    <p>{caption}</p>
                </div>
            </figcaption>
            {total <= 0 ? (
                <p className={styles.emptyChart}>{empty}</p>
            ) : (
                <ul className={styles.shareList}>
                    {rows.map((row) => (
                        <li key={row.key}>
                            <div>
                                <strong>{row.label}</strong>
                                <span>{row.detail}</span>
                            </div>
                            <div className={styles.shareTrack} aria-hidden="true">
                                <span
                                    style={{
                                        width: `${Math.max((row.value / total) * 100, 2)}%`,
                                        background: row.color,
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </figure>
    );
}
