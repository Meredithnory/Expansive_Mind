"use client";

import {
    DILIGENCE_AREAS,
    VENTURE_SCORE_CRITERIA,
    founderReportMarkdown,
    rankFounderOptions,
    type FounderReport,
} from "../lib/founder-report";
import styles from "./founder.module.scss";

const OPTION_COLORS = ["#ff8ec8", "#7ad4ff", "#8be8b8"];
const CRITERION_LABELS: Record<string, string> = {
    demand: "Demand",
    technical: "Build",
    market: "Market",
    differentiation: "Edge",
    capital: "Capital",
    execution: "Path",
};
const AREA_LABELS: Record<string, string> = {
    demand: "Need",
    market: "Market",
    competition: "Rivals",
    business: "Price",
    technical: "Build",
    regulatory: "Rules",
    capital: "Capital",
    risks: "Risk",
};

type RankedOption = ReturnType<typeof rankFounderOptions>["entries"][number];

function optionColor(index: number) {
    return OPTION_COLORS[index % OPTION_COLORS.length];
}

function ratingFor(entry: RankedOption, id: string) {
    return (
        entry.option.assessments?.find((item) => item.id === id)?.rating ??
        null
    );
}

function OpportunityCharts({
    entries,
    areas,
}: {
    entries: RankedOption[];
    areas: FounderReport["areas"];
}) {
    const maxFindings = Math.max(
        1,
        ...areas.map((area) => area.findings.length),
    );
    const scoreSummary = entries
        .map(
            (entry) =>
                `${entry.option.title}: ${entry.score ?? "unscored"} of 100, ${entry.coverage}% evidence coverage`,
        )
        .join(". ");

    return (
        <div className={styles.charts}>
            <figure className={styles.chart}>
                <figcaption>Priority vs evidence</figcaption>
                <div
                    className={styles.scoreChart}
                    role="img"
                    aria-label={scoreSummary}
                >
                    {entries.map((entry, index) => (
                        <div
                            className={styles.barRow}
                            key={entry.originalIndex}
                        >
                            <span
                                className={styles.barLabel}
                                title={entry.option.title}
                            >
                                <span
                                    className={styles.swatch}
                                    style={{ background: optionColor(index) }}
                                />
                                {entry.option.title}
                            </span>
                            <span className={styles.trackStack}>
                                <span className={styles.track}>
                                    <span
                                        className={styles.fill}
                                        style={{
                                            width: `${entry.score ?? 0}%`,
                                            background: optionColor(index),
                                        }}
                                    />
                                </span>
                                <span className={styles.track}>
                                    <span
                                        className={styles.fillMuted}
                                        style={{
                                            width: `${entry.coverage}%`,
                                            background: optionColor(index),
                                        }}
                                    />
                                </span>
                            </span>
                            <span className={styles.barValue}>
                                {entry.score ?? "—"}
                            </span>
                        </div>
                    ))}
                </div>
                <p className={styles.chartKey}>
                    Bright bar is the priority score. Faint bar is how much of
                    the rubric has sources.
                </p>
            </figure>

            <figure className={styles.chart}>
                <figcaption>How the options differ</figcaption>
                <ul className={styles.legend}>
                    {entries.map((entry, index) => (
                        <li key={entry.originalIndex}>
                            <span
                                className={styles.swatch}
                                style={{ background: optionColor(index) }}
                            />
                            <span title={entry.option.title}>
                                Option {index + 1}
                            </span>
                        </li>
                    ))}
                </ul>
                <div
                    className={styles.criterionChart}
                    role="img"
                    aria-label="Criterion ratings from 1 to 5 for each option"
                >
                    {VENTURE_SCORE_CRITERIA.map((criterion) => (
                        <div className={styles.criterionCol} key={criterion.id}>
                            <div className={styles.criterionBars}>
                                {entries.map((entry, index) => {
                                    const rating = ratingFor(
                                        entry,
                                        criterion.id,
                                    );
                                    return (
                                        <span
                                            key={entry.originalIndex}
                                            className={styles.criterionBar}
                                            title={`${entry.option.title}, ${criterion.label}: ${rating ?? "unknown"} of 5`}
                                            style={{
                                                height:
                                                    rating == null
                                                        ? "6%"
                                                        : `${(rating / 5) * 100}%`,
                                                background:
                                                    rating == null
                                                        ? "rgba(215, 235, 255, 0.16)"
                                                        : optionColor(index),
                                            }}
                                        />
                                    );
                                })}
                            </div>
                            <span className={styles.criterionName}>
                                {CRITERION_LABELS[criterion.id]}
                            </span>
                        </div>
                    ))}
                </div>
            </figure>

            <figure className={`${styles.chart} ${styles.chartWide}`}>
                <figcaption>Evidence by area</figcaption>
                <div
                    className={styles.areaChart}
                    role="img"
                    aria-label={areas
                        .map(
                            (area) =>
                                `${AREA_LABELS[area.id] || area.id}: ${area.findings.length} sourced findings`,
                        )
                        .join(". ")}
                >
                    {areas.map((area) => (
                        <div className={styles.areaCol} key={area.id}>
                            <span className={styles.areaCount}>
                                {area.findings.length}
                            </span>
                            <span className={styles.areaTrack}>
                                <span
                                    style={{
                                        height: `${area.findings.length === 0 ? 8 : (area.findings.length / maxFindings) * 100}%`,
                                        background:
                                            area.findings.length === 0
                                                ? "rgba(255, 212, 154, 0.35)"
                                                : "#7ad4ff",
                                    }}
                                />
                            </span>
                            <span className={styles.areaName}>
                                {AREA_LABELS[area.id] || area.id}
                            </span>
                        </div>
                    ))}
                </div>
            </figure>
        </div>
    );
}

export default function FounderReportView({ report }: { report: FounderReport }) {
    const covered = report.areas.filter((area) => area.findings.length).length;
    const ranking = rankFounderOptions(report.options);
    const generatedOn = report.generatedAt.slice(0, 10);

    function download() {
        const url = URL.createObjectURL(
            new Blob([founderReportMarkdown(report)], {
                type: "text/markdown;charset=utf-8",
            }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "founder-diligence.md";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }

    return (
        <section className={styles.report} aria-labelledby="founder-report-title">
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Opportunity report</p>
                    <h2 id="founder-report-title">What to test first</h2>
                    {report.scope ? (
                        <p className={styles.scope}>{report.scope}</p>
                    ) : null}
                    <p className={styles.meta}>
                        {covered}/{DILIGENCE_AREAS.length} areas sourced ·{" "}
                        {generatedOn}
                    </p>
                </div>
                <button type="button" onClick={download}>
                    Download
                </button>
            </header>

            {ranking.entries.length > 0 ? (
                <OpportunityCharts
                    entries={ranking.entries}
                    areas={report.areas}
                />
            ) : null}

            {ranking.entries.length > 0 ? (
                <div className={styles.options}>
                    {ranking.entries.map((entry) => {
                        const isFirst =
                            ranking.preferred === entry.originalIndex;
                        return (
                            <article
                                key={entry.originalIndex}
                                className={
                                    isFirst ? styles.leadOption : undefined
                                }
                            >
                                <p className={styles.eyebrow}>
                                    {entry.rank == null
                                        ? "Needs more evidence"
                                        : `Option ${entry.rank}`}
                                    {isFirst ? " · Test first" : ""}
                                </p>
                                <h3>{entry.option.title}</h3>
                                <p className={styles.score}>
                                    {entry.score == null
                                        ? "Not scored"
                                        : `${entry.score}`}
                                    <span>
                                        {entry.score == null
                                            ? "Priority score"
                                            : `${entry.coverage}% coverage`}
                                    </span>
                                </p>
                                {entry.criticalBarrier ? (
                                    <p className={styles.unknown}>
                                        Demand, feasibility, or capital is
                                        blocked. Resolve that before proceeding.
                                    </p>
                                ) : null}
                                <dl>
                                    <div>
                                        <dt>Buyer</dt>
                                        <dd>{entry.option.customer}</dd>
                                    </div>
                                    <div>
                                        <dt>Offer</dt>
                                        <dd>{entry.option.product}</dd>
                                    </div>
                                    <div>
                                        <dt>Edge</dt>
                                        <dd>{entry.option.upside}</dd>
                                    </div>
                                    <div>
                                        <dt>Risk</dt>
                                        <dd>{entry.option.risk}</dd>
                                    </div>
                                    <div>
                                        <dt>Next test</dt>
                                        <dd>{entry.option.nextMilestone}</dd>
                                    </div>
                                </dl>
                                <details>
                                    <summary>Score breakdown</summary>
                                    {VENTURE_SCORE_CRITERIA.map((criterion) => {
                                        const assessment =
                                            entry.option.assessments?.find(
                                                (item) =>
                                                    item.id === criterion.id,
                                            );
                                        return (
                                            <div
                                                className={styles.scoreCriterion}
                                                key={criterion.id}
                                            >
                                                <strong>
                                                    {criterion.label}{" "}
                                                    {assessment?.rating == null
                                                        ? "Unknown"
                                                        : `${assessment.rating}/5`}
                                                </strong>
                                                <p>
                                                    {assessment?.rationale ||
                                                        "No sourced assessment."}
                                                </p>
                                                {assessment?.evidence.map(
                                                    (evidence, index) => {
                                                        const source =
                                                            report.sources.find(
                                                                (item) =>
                                                                    item.id ===
                                                                    evidence.sourceId,
                                                            );
                                                        return source ? (
                                                            <details key={index}>
                                                                <summary>
                                                                    {source.id}
                                                                </summary>
                                                                <blockquote>
                                                                    {
                                                                        evidence.quote
                                                                    }
                                                                </blockquote>
                                                                <a
                                                                    href={
                                                                        source.url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    {source.title}{" "}
                                                                    ↗
                                                                </a>
                                                            </details>
                                                        ) : null;
                                                    },
                                                )}
                                            </div>
                                        );
                                    })}
                                </details>
                            </article>
                        );
                    })}
                </div>
            ) : null}

            <p className={styles.note}>
                Scores rank what to test. They are not a forecast of success.
            </p>

            <nav className={styles.nav} aria-label="Diligence areas">
                {DILIGENCE_AREAS.map(([id, title]) => (
                    <a key={id} href={`#founder-${id}`}>
                        {title}
                    </a>
                ))}
            </nav>

            {report.areas.map((area) => (
                <section
                    id={`founder-${area.id}`}
                    key={area.id}
                    className={styles.area}
                >
                    <h3>
                        {DILIGENCE_AREAS.find(([id]) => id === area.id)?.[1]}
                    </h3>
                    {area.findings.length ? (
                        area.findings.map((finding, index) => {
                            const source = report.sources.find(
                                (item) => item.id === finding.sourceId,
                            );
                            return (
                                <article
                                    key={index}
                                    className={styles.finding}
                                >
                                    <p>{finding.claim}</p>
                                    {source ? (
                                        <details>
                                            <summary>{finding.sourceId}</summary>
                                            <blockquote>
                                                {finding.quote}
                                            </blockquote>
                                            <a
                                                href={source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {source.title} ↗
                                            </a>
                                        </details>
                                    ) : null}
                                </article>
                            );
                        })
                    ) : (
                        <p className={styles.unknown}>
                            No sourced excerpt for this area yet.
                        </p>
                    )}
                    {area.analysis ? <p>{area.analysis}</p> : null}
                    {area.nextCheck ? (
                        <p className={styles.next}>Next: {area.nextCheck}</p>
                    ) : null}
                </section>
            ))}

            {report.limitations.length > 0 ? (
                <details className={styles.area}>
                    <summary>
                        Unresolved ({report.limitations.length})
                    </summary>
                    <ul>
                        {report.limitations.map((limit, index) => (
                            <li key={index}>{limit}</li>
                        ))}
                    </ul>
                </details>
            ) : null}

            <details className={styles.area}>
                <summary>Sources ({report.sources.length})</summary>
                <ul>
                    {report.sources.map((source) => (
                        <li key={source.id}>
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {source.id}: {source.title} ↗
                            </a>
                        </li>
                    ))}
                </ul>
            </details>

            <details className={styles.area}>
                <summary>How scores work</summary>
                <p>
                    Each option is rated 1–5 on demand, feasibility, market,
                    differentiation, capital, and execution. The score is
                    weighted points over the criteria that have sources. A
                    first choice needs enough coverage, no critical 1, and a
                    range above the others. Missing evidence stays unscored.
                </p>
            </details>
        </section>
    );
}
