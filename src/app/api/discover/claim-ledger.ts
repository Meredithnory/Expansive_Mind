import type { SourceDatabase } from "../../lib/paper-sources";
import { evidencePaper } from "../../lib/cited-text";
import { narrowerScope } from "../../lib/paper-scope";
import {
    isCommercialFriendlyLicenseUri,
    isUndeterminedLicenseText,
    logQuoteDecision,
    resolvableQuoteLink,
    visiblePaperQuote,
    type QuoteLicenseResult,
} from "../../lib/quote-eligibility";
import type {
    ClaimLedger,
    ClaimLedgerKind,
    ClaimLedgerRow,
    ClaimLedgerSource,
    DiscoverPaperCard,
    OpportunityReport,
    PaperExtraction,
    ReportConfidence,
    ReportGap,
} from "./report-types";

export const SHARE_LOCKED_ERROR =
    "Share is locked until every claim has a source excerpt.";

export type LedgerPaper = Pick<
    DiscoverPaperCard,
    "index" | "paperId" | "href"
> & {
    title?: string;
    doi?: string;
    sourceUrl?: string;
    licenseUrl?: string;
    database?: SourceDatabase;
};

export type LedgerExtraction = Pick<PaperExtraction, "index"> & {
    supportingExcerpt?: string;
    population?: string;
    /** Verified sentences by evidence id. Text only for quote-eligible papers. */
    evidence?: Array<{ id: string; quote?: string }>;
};

export type ClaimLedgerGateReason =
    | "complete"
    | "missing_report"
    | "empty_ledger"
    | "incomplete_rows";

export type ClaimLedgerGate =
    | {
          ok: true;
          reason: "complete";
          ledger: ClaimLedger;
          incompleteCount: 0;
      }
    | {
          ok: false;
          reason: Exclude<ClaimLedgerGateReason, "complete">;
          ledger: ClaimLedger;
          incompleteCount: number;
      };

function trimmed(value: string | undefined): string {
    return value?.trim() ?? "";
}

function claimText(title: string, fallback: string): string {
    return trimmed(title) || trimmed(fallback) || "Untitled claim";
}

/** "No standardized guidelines." and "no standardized guidelines" are one claim. */
function claimKey(claim: string): string {
    return claim
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function paperByIndex(
    papers: LedgerPaper[],
    index: number,
): LedgerPaper | undefined {
    return papers.find((paper) => paper.index === index);
}

function extractionByIndex(
    extractions: LedgerExtraction[],
    index: number,
): LedgerExtraction | undefined {
    return extractions.find((item) => item.index === index);
}

function excerptByIndex(
    extractions: LedgerExtraction[],
    index: number,
): string {
    return trimmed(extractionByIndex(extractions, index)?.supportingExcerpt);
}

/** Excerpts carry "## Section" markers from how we split papers; they aren't the paper's words. */
function withoutSectionMarkers(text: string): string {
    return text.replace(/(^|\s)#{1,6}\s+/g, "$1").replace(/\s+/g, " ").trim();
}

/**
 * The sentence this claim cited from the paper, when the writer cited an
 * evidence id for it. Otherwise the paper's one supporting excerpt.
 */
function claimExcerpt(
    extractions: LedgerExtraction[],
    paperIndex: number,
    evidenceIds: string[],
): string {
    const extraction = extractionByIndex(extractions, paperIndex);
    for (const id of evidenceIds) {
        if (evidencePaper(id) !== paperIndex) continue;
        const quote = trimmed(
            extraction?.evidence?.find((item) => item.id === id)?.quote,
        );
        if (quote) return withoutSectionMarkers(quote);
    }
    return withoutSectionMarkers(trimmed(extraction?.supportingExcerpt));
}

export function hasResolvableCitation(source: Pick<
    ClaimLedgerSource,
    "doi" | "paperId" | "href"
>): boolean {
    return Boolean(
        trimmed(source.doi) || trimmed(source.paperId) || trimmed(source.href),
    );
}

export function isClaimLedgerSourceComplete(source: ClaimLedgerSource): boolean {
    return (
        trimmed(source.quote).length > 0 &&
        hasResolvableCitation(source) &&
        isCommercialFriendlyLicenseUri(source.licenseUrl)
    );
}

/** A claim is sourced when at least one cited paper gives a licensed excerpt. */
export function isClaimLedgerRowComplete(row: ClaimLedgerRow): boolean {
    return row.sources.some(isClaimLedgerSourceComplete);
}

function ledgerLicenseResult(paper: LedgerPaper | undefined): QuoteLicenseResult {
    if (!paper || paper.database === "scholar") return "fail-closed";
    const url = trimmed(paper.licenseUrl);
    if (!url || isUndeterminedLicenseText(url)) return "unknown";
    if (!isCommercialFriendlyLicenseUri(url)) return "fail-closed";
    return "allowed";
}

function logLedgerQuoteDecisions(
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
) {
    const seen = new Set<string>();
    for (const paper of papers) {
        const paperId = trimmed(paper.paperId);
        if (!paperId || seen.has(paperId)) continue;
        seen.add(paperId);
        const title = trimmed(paper.title);
        const link = resolvableQuoteLink({
            doi: paper.doi,
            href: paper.href,
            sourceUrl: paper.sourceUrl,
        });
        const licenseResult = ledgerLicenseResult(paper);
        const excerpt =
            paper.database === "scholar"
                ? ""
                : excerptByIndex(extractions, paper.index);
        const shown =
            licenseResult === "allowed"
                ? visiblePaperQuote({
                      quote: excerpt,
                      title,
                      doi: paper.doi,
                      href: paper.href,
                      sourceUrl: paper.sourceUrl,
                      licenseUrl: paper.licenseUrl,
                  })
                : null;
        logQuoteDecision({
            paperId,
            licenseResult,
            quoteOmitted: !shown,
            titlePresent: title.length > 0,
            linkPresent: Boolean(link),
        });
    }
}

function sourceForCitation(
    paperIndex: number,
    evidenceIds: string[],
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
    question: string,
): ClaimLedgerSource {
    const paper = paperByIndex(papers, paperIndex);
    const doi = trimmed(paper?.doi) || undefined;
    const paperId = trimmed(paper?.paperId) || undefined;
    const href = trimmed(paper?.href) || undefined;
    const title = trimmed(paper?.title) || undefined;
    const scope =
        narrowerScope(
            question,
            extractionByIndex(extractions, paperIndex)?.population,
        ) ?? undefined;
    const scholar = paper?.database === "scholar";
    const shown = scholar
        ? null
        : visiblePaperQuote({
              quote: claimExcerpt(extractions, paperIndex, evidenceIds),
              title,
              doi,
              href,
              sourceUrl: paper?.sourceUrl,
              licenseUrl: paper?.licenseUrl,
          });
    const licenseUrl = shown ? trimmed(paper?.licenseUrl) : "";
    return {
        paperIndex,
        ...(paperId ? { paperId } : {}),
        ...(doi ? { doi } : {}),
        ...(href ? { href } : {}),
        ...(title ? { title } : {}),
        quote: shown?.quote ?? "",
        ...(licenseUrl ? { licenseUrl } : {}),
        ...(scope ? { scope } : {}),
    };
}

function citationIndexes(citations: number[], papers: LedgerPaper[]): number[] {
    const known = new Set(papers.map((paper) => paper.index));
    return [...new Set(citations.filter((index) => known.has(index)))];
}

function gapCitations(gap: ReportGap | undefined, papers: LedgerPaper[]): number[] {
    if (!gap) return [];
    return citationIndexes(gap.citations, papers);
}

/** Evidence ids the writer cited in these report fields, in order. */
function citedEvidence(report: OpportunityReport, keys: string[]): string[] {
    const map = report.sections.citationEvidence ?? {};
    return keys.flatMap((key) =>
        (map[key] ?? []).filter((id): id is string => Boolean(id)),
    );
}

function mergeSources(
    current: ClaimLedgerSource[],
    incoming: ClaimLedgerSource[],
): ClaimLedgerSource[] {
    const merged = current.slice();
    for (const source of incoming) {
        const at = merged.findIndex(
            (item) => item.paperIndex === source.paperIndex,
        );
        if (at === -1) merged.push(source);
        else if (!merged[at].quote && source.quote) merged[at] = source;
    }
    return merged;
}

/**
 * One row per claim. A claim the report repeats (a problem titled like its
 * gap) folds into the first row instead of showing twice.
 */
function pushClaimRow(
    rows: ClaimLedgerRow[],
    kind: ClaimLedgerKind,
    ordinal: number,
    claim: string,
    citations: number[],
    evidenceIds: string[],
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
    question: string,
    confidence?: ReportConfidence,
) {
    const sources = citationIndexes(citations, papers).map((paperIndex) =>
        sourceForCitation(paperIndex, evidenceIds, papers, extractions, question),
    );
    const key = claimKey(claim);
    const existing = rows.find((row) => claimKey(row.claim) === key);
    if (existing) {
        existing.sources = mergeSources(existing.sources, sources);
        return;
    }
    rows.push({
        id: `${kind}-${ordinal}`,
        kind,
        claim,
        sources,
        ...(confidence ? { confidence } : {}),
    });
}

function asPositiveIndex(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        return null;
    }
    return value;
}

export function toLedgerPapers(papers: unknown): LedgerPaper[] {
    if (!Array.isArray(papers)) return [];
    return papers.flatMap((paper) => {
        if (!paper || typeof paper !== "object") return [];
        const value = paper as Record<string, unknown>;
        const index = asPositiveIndex(value.index);
        if (index === null) return [];
        return [
            {
                index,
                paperId: typeof value.paperId === "string" ? value.paperId : "",
                href: typeof value.href === "string" ? value.href : "",
                ...(typeof value.title === "string" && value.title
                    ? { title: value.title }
                    : {}),
                ...(typeof value.doi === "string" && value.doi
                    ? { doi: value.doi }
                    : {}),
                ...(typeof value.sourceUrl === "string" && value.sourceUrl
                    ? { sourceUrl: value.sourceUrl }
                    : {}),
                ...(typeof value.licenseUrl === "string" && value.licenseUrl
                    ? { licenseUrl: value.licenseUrl }
                    : {}),
                ...(value.database === "nih" ||
                value.database === "springer" ||
                value.database === "scholar"
                    ? { database: value.database }
                    : {}),
            },
        ];
    });
}

function toLedgerEvidence(
    evidence: unknown,
): Array<{ id: string; quote?: string }> {
    if (!Array.isArray(evidence)) return [];
    return evidence.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const value = item as Record<string, unknown>;
        if (typeof value.id !== "string" || !value.id) return [];
        return [
            {
                id: value.id,
                ...(typeof value.quote === "string" && value.quote
                    ? { quote: value.quote }
                    : {}),
            },
        ];
    });
}

export function toLedgerExtractions(extractions: unknown): LedgerExtraction[] {
    if (!Array.isArray(extractions)) return [];
    return extractions.flatMap((extraction) => {
        if (!extraction || typeof extraction !== "object") return [];
        const value = extraction as Record<string, unknown>;
        const index = asPositiveIndex(value.index);
        if (index === null) return [];
        const evidence = toLedgerEvidence(value.evidence);
        return [
            {
                index,
                ...(typeof value.supportingExcerpt === "string"
                    ? { supportingExcerpt: value.supportingExcerpt }
                    : {}),
                ...(typeof value.population === "string" && value.population
                    ? { population: value.population }
                    : {}),
                ...(evidence.length > 0 ? { evidence } : {}),
            },
        ];
    });
}

/**
 * `question` is the discovery question: a source notes its paper's group
 * only when that group is narrower than what was asked.
 */
export function buildClaimLedger(
    report: OpportunityReport,
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
    question = "",
    options: { logDecisions?: boolean } = {},
): ClaimLedger {
    // Admin aggregates rebuild many ledgers; one log line per paper each time is noise.
    if (options.logDecisions !== false) logLedgerQuoteDecisions(papers, extractions);
    const rows: ClaimLedgerRow[] = [];
    const { gaps, problems, venturePotential } = report.sections;

    gaps.forEach((gap, index) => {
        pushClaimRow(
            rows,
            "gap",
            index + 1,
            claimText(gap.title, gap.description),
            gap.citations,
            citedEvidence(
                report,
                ["title", "description", "whyItMatters"].map(
                    (field) => `gaps.${index}.${field}`,
                ),
            ),
            papers,
            extractions,
            question,
            gap.confidence,
        );
    });

    problems.forEach((problem, index) => {
        const citations = problem.gapRefs.flatMap((gapRef) =>
            gapCitations(gaps[gapRef - 1], papers),
        );
        pushClaimRow(
            rows,
            "problem",
            index + 1,
            claimText(problem.title, problem.description),
            citations,
            citedEvidence(
                report,
                ["title", "description"].map(
                    (field) => `problems.${index}.${field}`,
                ),
            ),
            papers,
            extractions,
            question,
        );
    });

    venturePotential.forEach((item, index) => {
        pushClaimRow(
            rows,
            "venture",
            index + 1,
            claimText(item.title, item.thesis),
            item.citations,
            citedEvidence(
                report,
                ["title", "thesis", "feasibilitySignals", "risks"].map(
                    (field) => `venturePotential.${index}.${field}`,
                ),
            ),
            papers,
            extractions,
            question,
        );
    });

    return { rows };
}

export function attachClaimLedger(
    report: OpportunityReport,
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
    question = "",
): OpportunityReport {
    return {
        ...report,
        claimLedger: buildClaimLedger(report, papers, extractions, question),
    };
}

export function evaluateClaimLedger(ledger: ClaimLedger): ClaimLedgerGate {
    if (ledger.rows.length === 0) {
        return {
            ok: false,
            reason: "empty_ledger",
            ledger,
            incompleteCount: 0,
        };
    }
    const incompleteCount = ledger.rows.filter(
        (row) => !isClaimLedgerRowComplete(row),
    ).length;
    if (incompleteCount > 0) {
        return {
            ok: false,
            reason: "incomplete_rows",
            ledger,
            incompleteCount,
        };
    }
    return {
        ok: true,
        reason: "complete",
        ledger,
        incompleteCount: 0,
    };
}

export function evaluateShareGate(
    report: OpportunityReport | null | undefined,
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
): ClaimLedgerGate {
    if (!report) {
        return {
            ok: false,
            reason: "missing_report",
            ledger: { rows: [] },
            incompleteCount: 0,
        };
    }
    return evaluateClaimLedger(buildClaimLedger(report, papers, extractions));
}

export function shareLockDetail(gate: ClaimLedgerGate): string {
    if (gate.ok) return "";
    if (gate.reason === "incomplete_rows") {
        const n = gate.incompleteCount;
        return n === 1
            ? `${SHARE_LOCKED_ERROR} 1 still needs a licensed excerpt, paper link, or commercial-friendly license.`
            : `${SHARE_LOCKED_ERROR} ${n} still need a licensed excerpt, paper link, or commercial-friendly license.`;
    }
    return "Share stays locked until this brief has sourced claims.";
}
