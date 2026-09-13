"use client";

import { useState } from "react";
import { DILIGENCE_AREAS, SCENARIO_FIELDS, VENTURE_SCORE_CRITERIA, rankFounderOptions, calculateFounderScenario, founderReportMarkdown, type FounderReport, type ScenarioInputs } from "../lib/founder-report";
import { FinancialVisuals, VentureVisuals } from "./ReportVisuals";
import styles from "./founder.module.scss";

const CASES = ["Downside", "Base case", "Upside"];
const emptyInputs = () => Object.fromEntries(SCENARIO_FIELDS.map(([key]) => [key, null])) as ScenarioInputs;
const money = (value: number | null) => value === null ? "Not estimated" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function FounderReportView({ report }: { report: FounderReport }) {
    const [inputs, setInputs] = useState<ScenarioInputs[]>(() => CASES.map(emptyInputs));
    const [basis, setBasis] = useState("");
    const [targetYear, setTargetYear] = useState("");
    const results = inputs.map(calculateFounderScenario);
    const covered = report.areas.filter(area => area.findings.length).length;
    const ranking = rankFounderOptions(report.options);

    function download() {
        const scenarios = inputs.map((input, index) => `### ${CASES[index]} (user assumptions)\n\n${SCENARIO_FIELDS.map(([key, label]) => `${label}: ${input[key] ?? "Unknown"}`).join("\n\n")}\n\nAnnual revenue: ${money(results[index].revenue)}\n\nAnnual operating profit before interest and tax: ${money(results[index].operatingProfit)}\n\nAdditional funding to milestone: ${money(results[index].fundingRequired)}`).join("\n\n");
        const text = `${founderReportMarkdown(report)}\n\n## Financial scenarios — conditional, not forecasts\n\nTarget year: ${targetYear || "Not specified"}\n\nAssumptions and source notes: ${basis || "Not supplied; inputs are unverified user assumptions."}\n\n${scenarios}\n\nRevenue = paying customers × annual revenue per customer. Operating profit = revenue × gross margin − annual operating expenses. Funding = max(0, (monthly net burn × months + additional one-time costs) × (1 + contingency) − available cash). Do not double count one-time costs in burn. Valuation, financing availability, and investor returns are not calculated.`;
        const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url; link.download = "founder-diligence.md"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return <section className={styles.report} aria-labelledby="founder-report-title">
        <header className={styles.header}>
            <div><p className={styles.eyebrow}>Founder diligence · Needs validation</p>
                <h2 id="founder-report-title">Is this a business worth testing?</h2>
                <p>{report.scope}</p>
                <p>{covered} of {DILIGENCE_AREAS.length} areas have matching source excerpts · Generated {report.generatedAt.slice(0, 10)}</p>
            </div>
            <button type="button" onClick={download}>Download report & scenarios</button>
        </header>
        <VentureVisuals report={report} />
        <aside className={styles.notice}>
            <strong>Evidence can guide a decision; it cannot guarantee a venture’s outcome.</strong>
            <p>Source excerpts are checked for a text match. Their relevance and the conclusions still need review. Venture options are hypotheses. Revenue upside, funding required, and investment availability remain unknown until validated separately.</p>
        </aside>
        {report.options.length > 0 && <details className={styles.area}>
            <summary>Detailed option analysis & scoring method</summary>
            <p>{ranking.preferred !== null ? <>First to validate under this rubric: <strong>{report.options[ranking.preferred].title}</strong>. Its score range leads the alternatives; use the milestone below to test the case before committing capital.</> : "No clear first choice yet. Scores are provisional: missing evidence, closely matched options, or critical barriers prevent a reliable winner."}</p>
            <details className={styles.area}><summary>How priority scores work · Rubric v1</summary>
                <p>These scores prioritize validation effort. They are source-linked analyst judgments, not probabilities of success or investment returns. Ratings run from 1 (least favorable) to 5 (most favorable); 1 maps to 0 points, 3 to 50, and 5 to 100.</p>
                <ul>{VENTURE_SCORE_CRITERIA.map(criterion => <li key={criterion.id}><strong>{criterion.label}: {criterion.weight}%.</strong> {criterion.guide}</li>)}</ul>
                <p>Score = weighted points divided by assessed weight. Evidence coverage is the percentage of rubric weight assessed, not confidence in truth. Unknowns stay unscored. The displayed range shows the full possible score if unknown criteria are resolved, not a statistical confidence interval.</p>
                <p>Ranking requires at least 70% coverage and assessments of demand, technical feasibility, and capital efficiency. A first choice requires at least 60/100, no critical rating of 1, and a score range above every other option’s range. If any alternative is unranked, no overall winner is named. Equal scores share a rank. These thresholds are product heuristics, not empirically calibrated cutoffs.</p>
            </details>
            <div className={styles.options}>{ranking.entries.map(({ option, originalIndex, rank, score, coverage, lower, upper, criticalBarrier }) => <article key={originalIndex}>
                <p className={styles.eyebrow}>{rank === null ? "Unranked · More evidence needed" : `#${rank} · Provisional priority`}{ranking.preferred === originalIndex ? " · First to validate" : ""}</p><h4>{option.title}</h4>
                <p className={styles.score}>{score === null ? "Not scored" : `${score}/100`} <span>priority score</span></p>
                <p>Evidence coverage: {coverage}%<br />Range with missing criteria: {lower}–{upper}/100</p>
                {criticalBarrier && <p className={styles.unknown}>Critical demand, feasibility, or capital barrier. Resolve it before proceeding.</p>}
                <details><summary>Score breakdown & supporting evidence</summary>
                    {VENTURE_SCORE_CRITERIA.map(criterion => {
                        const assessment = option.assessments?.find(entry => entry.id === criterion.id);
                        return <div className={styles.scoreCriterion} key={criterion.id}><strong>{criterion.label} ({criterion.weight}%): {assessment?.rating == null ? "Unknown" : `${assessment.rating}/5`}</strong>
                            <p>{assessment?.rationale || "No source-backed assessment available. Run a new founder discovery to assess this criterion."}</p>
                            {assessment?.evidence.map((evidence, index) => {
                                const source = report.sources.find(item => item.id === evidence.sourceId);
                                return source ? <details key={index}><summary>Inspect {source.id}</summary><blockquote>{evidence.quote}</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></details> : null;
                            })}
                        </div>;
                    })}
                </details>
                <dl><dt>Buyer / payer</dt><dd>{option.customer}</dd><dt>Product & model</dt><dd>{option.product}</dd><dt>Potential advantage</dt><dd>{option.upside}</dd><dt>What could make it fail</dt><dd>{option.risk}</dd><dt>Before committing capital</dt><dd>{option.nextMilestone}</dd></dl>
            </article>)}</div>
        </details>}
        <nav className={styles.nav} aria-label="Founder report sections">{DILIGENCE_AREAS.map(([id, title]) => <a key={id} href={`#founder-${id}`}>{title}</a>)}<a href="#founder-financials">Revenue & funding scenarios</a></nav>
        {report.areas.map(area => <section id={`founder-${area.id}`} key={area.id} className={styles.area}>
            <h3>{DILIGENCE_AREAS.find(([id]) => id === area.id)?.[1]}</h3>
            {area.findings.length ? area.findings.map((finding, index) => {
                const source = report.sources.find(item => item.id === finding.sourceId)!;
                return <article key={index} className={styles.finding}><p>{finding.claim}</p>
                    <details><summary>Inspect matching excerpt · {finding.sourceId}</summary>
                        <blockquote>{finding.quote}</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><p>Accessed {source.retrievedAt.slice(0, 10)} · Publication date and applicability need checking.</p>
                    </details>
                </article>;
            }) : <p className={styles.unknown}>Evidence gap: no supporting excerpt validated for this area.</p>}
            <p><strong>Analysis · inference:</strong> {area.analysis || "Insufficient evidence to draw a conclusion."}</p>
            <p><strong>Next validation:</strong> {area.nextCheck}</p>
        </section>)}
        <section id="founder-financials" className={styles.area}>
            <h3>Revenue upside & funding required</h3>
            <p>Build three conditional scenarios for one venture option. All entries are your assumptions, not verified estimates. Missing inputs stay unknown; no market size, valuation, or fundraising probability is invented.</p>
            <FinancialVisuals scenarios={results.map((result, index) => ({ ...result, label: CASES[index] }))} />
            <label className={styles.inputLabel}>Venture option, target year, and milestone<input value={targetYear} onChange={event => setTargetYear(event.target.value)} maxLength={300} placeholder="e.g. Research tool · year 3 · paid pilot validation" /></label>
            <div className={styles.tableScroll}><table><caption>USD scenarios — enter assumptions to calculate</caption><thead><tr><th scope="col">Input</th>{CASES.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
                {SCENARIO_FIELDS.map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{inputs.map((input, index) => <td key={index}><input aria-label={`${CASES[index]}: ${label}`} type="number" min="0" max={key === "grossMargin" || key === "contingency" ? 100 : 1e12} step="any" placeholder="Unknown" value={input[key] ?? ""} onChange={event => {
                    const value = event.target.value === "" ? null : Number(event.target.value);
                    setInputs(current => current.map((entry, item) => item === index ? { ...entry, [key]: value } : entry));
                }} /></td>)}</tr>)}
                <tr className={styles.total}><th scope="row">Annual revenue</th>{results.map((result, index) => <td key={index}>{money(result.revenue)}</td>)}</tr>
                <tr className={styles.total}><th scope="row">Annual operating profit, before interest & tax</th>{results.map((result, index) => <td key={index}>{money(result.operatingProfit)}</td>)}</tr>
                <tr className={styles.total}><th scope="row">Additional funding to milestone</th>{results.map((result, index) => <td key={index}>{money(result.fundingRequired)}</td>)}</tr>
            </tbody></table></div>
            <details><summary>Calculation method & boundaries</summary><p>Annual revenue = paying customers × annual revenue per customer. Operating profit = revenue × gross margin − annual operating expenses.</p><p>Funding = (monthly net cash burn × months + additional one-time costs) × (1 + contingency) − available cash, with a minimum of zero. Net burn is after cash receipts. Do not include the same one-time expense in both burn and additional costs. A zero funding gap does not establish feasibility.</p><p>These scenarios omit financing terms, dilution, investor returns, valuation, and probability of technical or commercial success. Funding needed does not mean funding is obtainable. Use consistent dates, scope, and cost definitions.</p></details>
            <label className={styles.inputLabel}>Assumptions, source URLs, dates, and missing evidence<textarea value={basis} maxLength={6000} onChange={event => setBasis(event.target.value)} placeholder="For each input, record its source or why you assumed it. Include customer interviews, vendor quotes, salary budgets, and what could change the estimate." /></label>
            <p>Scenario edits are kept only while this report is open. Download to retain your inputs with the report.</p>
        </section>
        <section className={styles.area}><h3>Coverage & unresolved questions</h3><ul>{report.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></section>
        <details className={styles.area}><summary>Source register ({report.sources.length})</summary><ul>{report.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.id}: {source.title} ↗</a> · accessed {source.retrievedAt.slice(0, 10)}</li>)}</ul></details>
    </section>;
}
