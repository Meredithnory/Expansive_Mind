export const DILIGENCE_AREAS = [
    ["demand", "Customer, buyer, and unmet need"],
    ["market", "Market size and reachable customers"],
    ["competition", "Competitors and alternatives"],
    ["business", "Pricing, reimbursement, and business model"],
    ["technical", "Technical feasibility and development"],
    ["regulatory", "Regulatory pathway and intellectual property"],
    ["capital", "Capital requirements and funding routes"],
    ["risks", "Failure risks and decision gates"],
] as const;

export type DiligenceArea = typeof DILIGENCE_AREAS[number][0];
export type FounderSource = {
    id: string;
    title: string;
    url: string;
    retrievedAt: string;
    text: string;
};
export type FounderFinding = {
    claim: string;
    sourceId: string;
    quote: string;
};

export const VENTURE_SCORE_CRITERIA = [
    { id: "demand", label: "Customer demand", weight: 25, guide: "1: evidence of weak demand; 3: supported need with buying behavior partly tested; 5: strong evidence of demand from the intended paying customer." },
    { id: "technical", label: "Technical feasibility", weight: 20, guide: "1: major feasibility barriers; 3: relevant proof of concept with translation gaps; 5: reproducible evidence in the intended use setting." },
    { id: "market", label: "Reachable revenue opportunity", weight: 15, guide: "1: limited reachable demand or pricing; 3: supported customer segment and plausible pricing; 5: strong evidence of a reachable segment with attractive economics." },
    { id: "differentiation", label: "Competitive differentiation", weight: 15, guide: "1: little demonstrated advantage; 3: a supported advantage with competition still relevant; 5: compelling demonstrated advantage over documented alternatives." },
    { id: "capital", label: "Capital efficiency", weight: 15, guide: "1: costly milestones relative to available resources; 3: a plausible milestone budget with material gaps; 5: well-supported affordable validation milestones. Unknown costs or founder resources are not evidence of efficiency." },
    { id: "execution", label: "Execution path", weight: 10, guide: "1: substantial documented regulatory, IP, or delivery barriers; 3: a plausible path with unresolved dependencies; 5: strong evidence of a tractable path for this product and jurisdiction." },
] as const;
export type VentureScoreCriterion = typeof VENTURE_SCORE_CRITERIA[number]["id"];
export type VentureAssessment = { id: VentureScoreCriterion; rating: number | null; rationale: string; evidence: { sourceId: string; quote: string }[] };
export type FounderOption = { title: string; customer: string; product: string; upside: string; risk: string; nextMilestone: string; assessments?: VentureAssessment[] };
export type FounderReport = {
    version: 1;
    generatedAt: string;
    scope: string;
    status: "needs-validation";
    sources: FounderSource[];
    limitations: string[];
    areas: { id: DiligenceArea; findings: FounderFinding[]; analysis: string; nextCheck: string }[];
    options: FounderOption[];
};

const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" ? value as Record<string, unknown> : {};
const string = (value: unknown, limit = 2400) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const normalized = (value: string) => value.replace(/\s+/g, " ").trim();

export function safeSourceUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password && !url.port;
    } catch { return false; }
}

/** A matching excerpt establishes provenance only, never the truth of a claim. */
export function parseFounderReport(raw: unknown): FounderReport | undefined {
    const value = object(raw);
    if (value.version !== 1) return undefined;
    const sources = array(value.sources).slice(0, 20).map(object).map(source => ({
        id: string(source.id, 40), title: string(source.title, 300),
        url: string(source.url, 2000), retrievedAt: string(source.retrievedAt, 40),
        text: string(source.text, 18000),
    })).filter(source => source.id && source.text && safeSourceUrl(source.url));
    const uniqueSources = sources.filter((source, index) => sources.findIndex(other => other.id === source.id) === index);
    const areas = DILIGENCE_AREAS.map(([id]) => {
        const area = object(array(value.areas).find(entry => object(entry).id === id));
        const findings = array(area.findings).slice(0, 4).map(object).map(finding => ({
            claim: string(finding.claim), sourceId: string(finding.sourceId, 40), quote: string(finding.quote, 900),
        })).filter(finding => {
            const source = uniqueSources.find(entry => entry.id === finding.sourceId);
            return finding.claim && finding.quote.length >= 20 && source && normalized(source.text).includes(normalized(finding.quote));
        });
        return { id, findings, analysis: string(area.analysis), nextCheck: string(area.nextCheck) || "Obtain current primary evidence before committing capital." };
    });
    return {
        version: 1, generatedAt: string(value.generatedAt, 40), scope: string(value.scope, 500),
        status: "needs-validation", sources: uniqueSources, areas,
        limitations: array(value.limitations).map(entry => string(entry)).filter(Boolean).slice(0, 16),
        options: array(value.options).slice(0, 3).map(object).map(option => ({
            title: string(option.title, 200), customer: string(option.customer), product: string(option.product),
            upside: string(option.upside), risk: string(option.risk), nextMilestone: string(option.nextMilestone),
            assessments: VENTURE_SCORE_CRITERIA.map(({ id }) => {
                const assessment = object(array(option.assessments).find(entry => object(entry).id === id));
                const evidence = array(assessment.evidence).slice(0, 3).map(object).map(entry => ({ sourceId: string(entry.sourceId, 40), quote: string(entry.quote, 900) })).filter(entry => {
                    const source = uniqueSources.find(item => item.id === entry.sourceId);
                    return entry.quote.length >= 20 && source && normalized(source.text).includes(normalized(entry.quote));
                });
                const rationale = string(assessment.rationale);
                const rating = typeof assessment.rating === "number" && Number.isInteger(assessment.rating) && assessment.rating >= 1 && assessment.rating <= 5 && evidence.length > 0 && rationale ? assessment.rating : null;
                return { id, rating, rationale: rating === null ? "Insufficient source-backed assessment. Gather evidence before scoring this criterion." : rationale, evidence: rating === null ? [] : evidence };
            }),
        })).filter(option => option.title),
    };
}

/** Fixed product rubric. No model-supplied total, rank, or probability is trusted. */
export function scoreFounderOption(option: FounderOption) {
    let coveredWeight = 0;
    let earned = 0;
    for (const criterion of VENTURE_SCORE_CRITERIA) {
        const assessment = option.assessments?.find(entry => entry.id === criterion.id);
        if (!assessment || assessment.rating === null || !Number.isInteger(assessment.rating) || assessment.rating < 1 || assessment.rating > 5 || !assessment.evidence.length || !assessment.rationale) continue;
        coveredWeight += criterion.weight;
        earned += criterion.weight * (assessment.rating - 1) / 4;
    }
    const critical = ["demand", "technical", "capital"];
    const eligible = coveredWeight >= 70 && critical.every(id => {
        const assessment = option.assessments?.find(entry => entry.id === id);
        return assessment?.rating != null && assessment.rating >= 1 && assessment.rating <= 5 && Number.isInteger(assessment.rating) && assessment.evidence.length > 0 && Boolean(assessment.rationale);
    });
    const criticalBarrier = critical.some(id => option.assessments?.find(entry => entry.id === id)?.rating === 1);
    return { score: coveredWeight ? Math.round(earned / coveredWeight * 100) : null, coverage: coveredWeight,
        lower: earned, upper: earned + 100 - coveredWeight, eligible, criticalBarrier };
}

export function rankFounderOptions(options: FounderOption[]) {
    const entries = options.map((option, index) => ({ option, originalIndex: index, ...scoreFounderOption(option) }))
        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.score ?? -1) - (a.score ?? -1) || a.originalIndex - b.originalIndex);
    const ranked = entries.map(entry => ({ ...entry, rank: entry.eligible ? 1 + entries.filter(other => other.eligible && other.score! > entry.score!).length : null }));
    const first = ranked[0];
    // Unknown competitors and overlapping score ranges prevent a confident winner.
    const preferred = ranked.length > 1 && ranked.every(entry => entry.eligible) && first.score! >= 60 && !first.criticalBarrier && ranked.slice(1).every(other => first.lower > other.upper) ? first.originalIndex : null;
    return { entries: ranked, preferred };
}

export const SCENARIO_FIELDS = [
    ["customers", "Paying customers in target year"],
    ["price", "Annual revenue per customer (USD)"],
    ["grossMargin", "Gross margin (%)"],
    ["annualOpex", "Annual operating expense (USD)"],
    ["monthlyBurn", "Monthly net cash burn to milestone (USD)"],
    ["months", "Months to milestone"],
    ["oneTimeCosts", "Additional one-time costs (USD)"],
    ["contingency", "Cost contingency (%)"],
    ["cashAvailable", "Cash already available (USD)"],
] as const;
export type ScenarioInputs = Record<typeof SCENARIO_FIELDS[number][0], number | null>;
export function calculateFounderScenario(input: ScenarioInputs) {
    const valid = (...keys: (keyof ScenarioInputs)[]) => keys.every(key => {
        const value = input[key];
        return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12;
    });
    const revenue = valid("customers", "price") ? input.customers! * input.price! : null;
    const operatingProfit = revenue !== null && valid("grossMargin", "annualOpex") && input.grossMargin! <= 100
        ? revenue * input.grossMargin! / 100 - input.annualOpex! : null;
    const fundingRequired = valid("monthlyBurn", "months", "oneTimeCosts", "contingency", "cashAvailable") && input.contingency! <= 100
        ? Math.max(0, (input.monthlyBurn! * input.months! + input.oneTimeCosts!) * (1 + input.contingency! / 100) - input.cashAvailable!) : null;
    return { revenue, operatingProfit, fundingRequired };
}

export function founderReportMarkdown(report: FounderReport) {
    const ranking = rankFounderOptions(report.options);
    return ["## Founder diligence", `Scope: ${report.scope}. Retrieved: ${report.generatedAt}.`,
        "Decision status: needs validation. Findings have matching source excerpts; this is not independent verification. Analysis and venture options are hypotheses. Financial upside and funding requirements remain unknown until explicit inputs are supplied.",
        "### Venture priority scores (rubric v1)",
        ranking.preferred === null ? "No clear first choice established. Rankings are provisional; resolve missing evidence and close scores before selecting a venture." : `First to validate under this rubric: ${report.options[ranking.preferred].title}. This prioritizes investigation, not investment returns.`,
        "Scores are source-linked analyst judgments, not probabilities or verified outcomes. Weights: customer demand 25%, technical feasibility 20%, reachable revenue 15%, differentiation 15%, capital efficiency 15%, execution 10%. Each criterion is rated 1–5 and maps to 0–100. Score = weighted points / assessed weight. Coverage is assessed weight, not statistical confidence. Unknown criteria stay unscored; the range shows all possible scores if missing criteria were resolved. Ranking requires 70% coverage plus demand, technical, and capital assessments. A first choice needs at least 60/100, no critical rating of 1, and a range entirely above every eligible competitor. These are product heuristics, not empirically calibrated cutoffs.",
        ...ranking.entries.map(({ option, rank, score, coverage, lower, upper, criticalBarrier }) => `### ${rank === null ? "Unranked" : `Rank ${rank}`} — ${option.title}\n\nPriority score: ${score === null ? "Not scored" : `${score}/100`}; evidence coverage: ${coverage}%; range from missing criteria: ${lower}–${upper}/100.${criticalBarrier ? " Critical feasibility, demand, or capital barrier: validate before proceeding." : ""}\n\n${VENTURE_SCORE_CRITERIA.map(criterion => {
            const assessment = option.assessments?.find(entry => entry.id === criterion.id);
            return `${criterion.label} (${criterion.weight}%): ${assessment?.rating ?? "Unknown"}${assessment?.rating != null ? "/5" : ""}. ${assessment?.rationale || "No assessment available."}\n\n${assessment?.evidence.map(entry => `[${entry.sourceId}] “${entry.quote}”`).join("\n\n") || ""}`;
        }).join("\n\n")}\n\nBuyer: ${option.customer}\n\nProduct: ${option.product}\n\nPotential upside: ${option.upside}\n\nRisk: ${option.risk}\n\nNext milestone: ${option.nextMilestone}`),
        ...report.areas.map(area => `### ${DILIGENCE_AREAS.find(([id]) => id === area.id)?.[1]}\n\n${area.findings.length ? area.findings.map(finding => `${finding.claim} [${finding.sourceId}]\n\nSource excerpt: “${finding.quote}”`).join("\n\n") : "No supporting source excerpt validated for this area."}\n\nAnalysis (inference): ${area.analysis || "Insufficient evidence."}\n\nNext check: ${area.nextCheck}`),
        "### Coverage limits", ...report.limitations.map(limit => `- ${limit}`),
        "### Diligence sources", ...report.sources.map(source => `[${source.id}: ${source.title}](${source.url}) — accessed ${source.retrievedAt}`),
    ].join("\n\n");
}
