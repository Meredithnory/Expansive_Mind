"use client";

import {
    DILIGENCE_AREAS,
    VENTURE_SCORE_CRITERIA,
    founderReportMarkdown,
    rankFounderOptions,
    type FounderReport,
} from "../lib/founder-report";
import styles from "./founder.module.scss";

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
