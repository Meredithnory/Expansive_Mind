"use client";

import { useMemo, useState } from "react";
import {
    areaPath,
    chartPolyline,
    featureColor,
    featureLabel,
    formatCompact,
    formatUsd,
    type DailyPoint,
} from "../lib/admin-overview";
import styles from "./admin.module.scss";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = 28;

export function TrendChart({
    daily,
}: {
    daily: DailyPoint[];
}) {
    const [hover, setHover] = useState<number | null>(null);
    const costs = daily.map((row) => row.costUsd);
    const calls = daily.map((row) => row.calls);
    const costLine = useMemo(
        () => chartPolyline(costs, WIDTH, HEIGHT, PAD),
        [costs],
    );
    const callLine = useMemo(
        () => chartPolyline(calls, WIDTH, HEIGHT, PAD),
        [calls],
    );
    const costArea = useMemo(
        () => areaPath(costs, WIDTH, HEIGHT, PAD),
        [costs],
    );
    const active = hover == null ? null : daily[hover];
    const maxCost = Math.max(...costs, 0);
    const maxCalls = Math.max(...calls, 0);

    return (
        <figure className={styles.chartBlock}>
            <figcaption>
                <div>
                    <h2>Metered activity</h2>
                    <p>Daily AI cost and call volume, last 30 days</p>
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
                            {formatUsd(active.costUsd, 4)} ·{" "}
                            {active.calls.toLocaleString()} calls
                            {active.failures
                                ? ` · ${active.failures} failed`
                                : ""}
                        </span>
                    </div>
                ) : (
                    <div className={styles.chartLegend}>
                        <span data-tone="cost">Cost</span>
                        <span data-tone="volume">Volume</span>
                    </div>
                )}
            </figcaption>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label="Daily AI cost and call volume for the last 30 days"
                onMouseLeave={() => setHover(null)}
                onMouseMove={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const x =
                        ((event.clientX - bounds.left) / bounds.width) * WIDTH;
                    const t = (x - PAD) / Math.max(WIDTH - PAD * 2, 1);
                    const index = Math.round(t * (daily.length - 1));
                    setHover(
                        Math.min(daily.length - 1, Math.max(0, index)),
                    );
                }}
            >
                {[0.25, 0.5, 0.75, 1].map((tick) => (
                    <line
                        key={tick}
                        x1={PAD}
                        x2={WIDTH - PAD}
                        y1={PAD + (HEIGHT - PAD * 2) * (1 - tick)}
                        y2={PAD + (HEIGHT - PAD * 2) * (1 - tick)}
                        className={styles.chartGrid}
                    />
                ))}
                <path d={costArea} className={styles.chartArea} />
                <path d={costLine} className={styles.chartCost} fill="none" />
                <path d={callLine} className={styles.chartVolume} fill="none" />
                {active && hover != null && daily.length > 1 ? (
                    <line
                        x1={
                            PAD +
                            (hover / (daily.length - 1)) * (WIDTH - PAD * 2)
                        }
                        x2={
                            PAD +
                            (hover / (daily.length - 1)) * (WIDTH - PAD * 2)
                        }
                        y1={PAD}
                        y2={HEIGHT - PAD}
                        className={styles.chartHover}
                    />
                ) : null}
                <text x={PAD} y={16} className={styles.chartAxis}>
                    {formatUsd(maxCost)}
                </text>
                <text
                    x={WIDTH - PAD}
                    y={16}
                    textAnchor="end"
                    className={styles.chartAxis}
                >
                    {formatCompact(maxCalls)} calls
                </text>
            </svg>
        </figure>
    );
}

export function MixChart({
    rows,
}: {
    rows: Array<{ key: string; label: string; value: number }>;
}) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return (
        <figure className={styles.chartBlock}>
            <figcaption>
                <div>
                    <h2>Spend mix</h2>
                    <p>Share of 30-day metered AI cost</p>
                </div>
            </figcaption>
            {total <= 0 ? (
                <p className={styles.emptyChart}>No metered spend yet.</p>
            ) : (
                <ul className={styles.shareList}>
                    {rows.map((row) => {
                        const share = row.value / total;
                        return (
                            <li key={row.key}>
                                <div>
                                    <strong>{row.label}</strong>
                                    <span>
                                        {formatUsd(row.value)} ·{" "}
                                        {Math.round(share * 100)}%
                                    </span>
                                </div>
                                <div
                                    className={styles.shareTrack}
                                    aria-hidden="true"
                                >
                                    <span
                                        style={{
                                            width: `${Math.max(share * 100, 2)}%`,
                                            background: featureColor(row.key),
                                        }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </figure>
    );
}

export function AccountMix({
    free,
    pro,
    guests,
}: {
    free: number;
    pro: number;
    guests: number;
}) {
    const slices = [
        { key: "free", label: "Free", value: free, color: "#0ab1ff" },
        { key: "pro", label: "Paid", value: pro, color: "#ff168f" },
        { key: "guest", label: "Guest nets", value: guests, color: "#8b8b96" },
    ].filter((slice) => slice.value > 0);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    let offset = 0;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;

    return (
        <figure className={styles.chartBlock}>
            <figcaption>
                <div>
                    <h2>Account mix</h2>
                    <p>Current seats and guest networks</p>
                </div>
            </figcaption>
            {total <= 0 ? (
                <p className={styles.emptyChart}>No account records yet.</p>
            ) : (
                <div className={styles.donutWrap}>
                    <svg
                        viewBox="0 0 120 120"
                        role="img"
                        aria-label="Account mix by plan"
                    >
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            className={styles.donutTrack}
                        />
                        {slices.map((slice) => {
                            const length = (slice.value / total) * circumference;
                            const circle = (
                                <circle
                                    key={slice.key}
                                    cx="60"
                                    cy="60"
                                    r={radius}
                                    stroke={slice.color}
                                    strokeDasharray={`${length} ${circumference - length}`}
                                    strokeDashoffset={-offset}
                                    className={styles.donutSlice}
                                />
                            );
                            offset += length;
                            return circle;
                        })}
                        <text x="60" y="56" textAnchor="middle" className={styles.donutValue}>
                            {total}
                        </text>
                        <text x="60" y="72" textAnchor="middle" className={styles.donutLabel}>
                            total
                        </text>
                    </svg>
                    <ul>
                        {slices.map((slice) => (
                            <li key={slice.key}>
                                <i style={{ background: slice.color }} />
                                {slice.label}
                                <strong>{slice.value}</strong>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </figure>
    );
}

export function FeatureStack({ daily }: { daily: DailyPoint[] }) {
    const features = useMemo(() => {
        const keys = new Set<string>();
        daily.forEach((row) =>
            Object.keys(row.features).forEach((key) => keys.add(key)),
        );
        return [...keys];
    }, [daily]);
    const totals = features.map((feature) =>
        daily.reduce(
            (sum, row) => sum + (row.features[feature]?.calls ?? 0),
            0,
        ),
    );
    const max = Math.max(...daily.map((row) => row.calls), 1);
    const barWidth = daily.length
        ? (WIDTH - PAD * 2) / daily.length
        : 0;

    return (
        <figure className={styles.chartBlock}>
            <figcaption>
                <div>
                    <h2>Product volume</h2>
                    <p>Calls by product line each day</p>
                </div>
                <div className={styles.chartLegend}>
                    {features.slice(0, 5).map((feature) => (
                        <span key={feature} style={{ color: featureColor(feature) }}>
                            {featureLabel(feature)}
                        </span>
                    ))}
                </div>
            </figcaption>
            {totals.every((value) => value === 0) ? (
                <p className={styles.emptyChart}>No product volume yet.</p>
            ) : (
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    role="img"
                    aria-label="Stacked daily call volume by product"
                >
                    {daily.map((row, index) => {
                        let y = HEIGHT - PAD;
                        const x = PAD + index * barWidth;
                        return features.map((feature) => {
                            const value = row.features[feature]?.calls ?? 0;
                            const h = (value / max) * (HEIGHT - PAD * 2);
                            y -= h;
                            if (!h) return null;
                            return (
                                <rect
                                    key={`${row.date}-${feature}`}
                                    x={x + 1}
                                    y={y}
                                    width={Math.max(barWidth - 2, 1)}
                                    height={h}
                                    fill={featureColor(feature)}
                                    opacity={0.88}
                                >
                                    <title>
                                        {row.date} · {featureLabel(feature)} ·{" "}
                                        {value}
                                    </title>
                                </rect>
                            );
                        });
                    })}
                </svg>
            )}
        </figure>
    );
}
