"use client";
import type { OpportunityReport, PaperExtraction } from "../api/discover/report-types";
import { paperDesignLabel } from "../lib/claim-evidence";
import { rankFounderOptions, VENTURE_SCORE_CRITERIA, type FounderReport } from "../lib/founder-report";
import styles from "./report-visuals.module.scss";

export function ScienceVisuals({ report, extractions, onCite }: { report: OpportunityReport; extractions: PaperExtraction[]; onCite: (index: number) => void }) {
    const types = [...new Set(extractions.map(p => paperDesignLabel(p)))];
    return <section className={styles.card} aria-label="Science at a glance"><h3>Science at a glance</h3>
        <p>Research gaps suggest experiments to test. They do not establish commercial viability.</p>
        <div className={styles.grid}><div><h4>Evidence mix · {extractions.length} classified papers</h4>
            {types.map(type => { const papers = extractions.filter(p => paperDesignLabel(p) === type); return <div key={type} className={styles.row}>
                <strong>{type} · {papers.length}</strong><div className={styles.track}><span style={{width: `${papers.length / Math.max(1, extractions.length) * 100}%`}} /></div>
                <div>{papers.map(p => <button key={p.index} onClick={() => onCite(p.index)}>Paper {p.index}</button>)}</div>
            </div>; })}<p>Counts describe this report’s evidence, not study quality or effect size.</p></div>
            <div><h4>What to validate next</h4>{report.sections.gaps.map((gap, i) => <details key={i} className={styles.row}><summary>{gap.confidence === "established" ? "in this run" : gap.confidence} · {gap.title}</summary>
                <p>{gap.description}</p>{gap.scopeNote ? <p>{gap.scopeNote}</p> : null}<p>{gap.whyItMatters}</p>{gap.citations.map(id => <button key={id} onClick={() => onCite(id)}>Inspect Paper {id}</button>)}
                {report.sections.projectSeeds.filter(seed => seed.gapRef === i + 1).map((seed, j) => <p key={j}><strong>Next experiment:</strong> {seed.oneLiner}</p>)}
            </details>)}<p>{report.sections.couldNotVerify.length} unresolved limitations are listed in the full report below.</p></div></div>
    </section>;
}

export function VentureVisuals({ report }: { report: FounderReport }) {
    const ranking = rankFounderOptions(report.options);
    return <section className={styles.card} aria-label="Venture decision dashboard"><h3>{ranking.preferred === null ? "Decision: gather more evidence before choosing" : `First to validate: ${report.options[ranking.preferred].title}`}</h3>
        <p>This is a validation priority, not a finding that an investment is viable. Inspect each rating’s rationale and source before acting.</p>
        {ranking.entries.map(entry => <article className={styles.row} key={entry.originalIndex}><h4>{entry.option.title}</h4>
            <p>{entry.criticalBarrier ? "Resolve a critical barrier first" : entry.rank === null ? "Not enough evidence to rank" : "Candidate for further validation"} · {entry.coverage}% of rubric weight assessed</p>
            <div className={styles.track} aria-label={`Priority score ${entry.score ?? "unknown"} out of 100`}><span style={{width: `${entry.score ?? 0}%`}} /></div>
            <p>{entry.score === null ? "Unknown score" : `${entry.score}/100 provisional priority`} · Missing-evidence range {entry.lower}–{entry.upper}</p>
            <div className={styles.grid}>{VENTURE_SCORE_CRITERIA.map(criterion => {
                const a = entry.option.assessments?.find(a => a.id === criterion.id);
                return <details key={criterion.id}><summary>{criterion.label}: {a?.rating == null ? "Unknown" : `${a.rating}/5`}</summary><p>{a?.rationale || "No assessment available."}</p>
                    {a?.evidence.map((e, i) => {const source = report.sources.find(s => s.id === e.sourceId); return source ? <div key={i}><blockquote>{e.quote}</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer">{source.id}: {source.title}</a></div> : null;})}</details>;
            })}</div><p><strong>Decision gate:</strong> {entry.option.nextMilestone}</p>
        </article>)}
    </section>;
}

export function FinancialVisuals({ scenarios }: { scenarios: { label: string; revenue: number | null; fundingRequired: number | null }[] }) {
    const values = scenarios.flatMap(s => [s.revenue, s.fundingRequired]).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!values.length) return <p>Revenue and funding charts will appear when you enter the required assumptions below. Missing amounts are not plotted as zero.</p>;
    const maximum = Math.max(1, ...values);
    const usd = (n: number) => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
    return <figure className={styles.card}><figcaption>Scenario comparison · user assumptions, not forecasts</figcaption>
        {scenarios.map(s => <div className={styles.row} key={s.label}><strong>{s.label}</strong>{(["revenue", "fundingRequired"] as const).map(key => <div key={key}><p>{key === "revenue" ? "Annual revenue" : "Additional funding to milestone"}: {s[key] === null ? "Unknown" : usd(s[key])}</p>{s[key] !== null && <div className={styles.track}><span style={{width:`${s[key] / maximum * 100}%`}} /></div>}</div>)}</div>)}
        <p>Shared USD scale. Annual revenue and milestone funding cover different periods; their difference is not profit or return. Sources and calculation assumptions are recorded below.</p>
    </figure>;
}
