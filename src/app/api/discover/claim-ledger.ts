import type { SourceDatabase } from "../../lib/paper-sources";
import { isCommercialFriendlyLicenseUri } from "../../lib/quote-eligibility";
import type {
    ClaimLedger,
    ClaimLedgerKind,
    ClaimLedgerRow,
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
    doi?: string;
    licenseUrl?: string;
    database?: SourceDatabase;
};

export type LedgerExtraction = Pick<PaperExtraction, "index"> & {
    supportingExcerpt?: string;
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

function paperByIndex(
    papers: LedgerPaper[],
    index: number,
): LedgerPaper | undefined {
    return papers.find((paper) => paper.index === index);
}

/** Keep assertions in the row identity: changing prose invalidates old evidence. */
export function ledgerClaimText(...parts: string[]): string {
    return parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
}

function normalizeQuote(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

export function hasResolvableCitation(row: Pick<
    ClaimLedgerRow,
    "doi" | "paperId" | "href"
>): boolean {
    return Boolean(
        trimmed(row.doi) || trimmed(row.paperId) || trimmed(row.href),
    );
}

export function isClaimLedgerRowComplete(row: ClaimLedgerRow): boolean {
    return (
        trimmed(row.quote).length > 0 &&
        hasResolvableCitation(row) &&
        isCommercialFriendlyLicenseUri(row.licenseUrl)
    );
}

function rowForCitation(
    kind: ClaimLedgerKind,
    ordinal: number,
    claim: string,
    paperIndex: number,
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
    confidence?: ReportConfidence,
): ClaimLedgerRow {
    const paper = paperByIndex(papers, paperIndex);
    const doi = trimmed(paper?.doi) || undefined;
    const paperId = trimmed(paper?.paperId) || undefined;
    const href = trimmed(paper?.href) || undefined;
    const scholar = paper?.database === "scholar";
    const licenseUrl =
        !scholar && isCommercialFriendlyLicenseUri(paper?.licenseUrl)
            ? trimmed(paper?.licenseUrl)
            : "";
    return {
        id: `${kind}-${ordinal}-p${paperIndex}`,
        kind,
        claim,
        paperIndex,
        ...(paperId ? { paperId } : {}),
        ...(doi ? { doi } : {}),
        ...(href ? { href } : {}),
        quote: "",
        ...(licenseUrl ? { licenseUrl } : {}),
        ...(confidence ? { confidence } : {}),
    };
}

function unresolvedRow(
    kind: ClaimLedgerKind,
    ordinal: number,
    claim: string,
    confidence?: ReportConfidence,
): ClaimLedgerRow {
    return {
        id: `${kind}-${ordinal}-p0`,
        kind,
        claim,
        quote: "",
        ...(confidence ? { confidence } : {}),
    };
}

function citationIndexes(citations: number[]): number[] {
    // Preserve missing references so they remain visible blockers at share time.
    return [...new Set(citations)];
}

function gapCitations(gap: ReportGap | undefined): number[] {
    if (!gap) return [];
    return citationIndexes(gap.citations);
}

function pushClaimRows(
    rows: ClaimLedgerRow[],
    kind: ClaimLedgerKind,
    ordinal: number,
    claim: string,
    citations: number[],
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
    confidence?: ReportConfidence,
) {
    const resolved = citationIndexes(citations);
    if (resolved.length === 0) {
        rows.push(unresolvedRow(kind, ordinal, claim, confidence));
        return;
    }
    for (const paperIndex of resolved) {
        rows.push(
            rowForCitation(
                kind,
                ordinal,
                claim,
                paperIndex,
                papers,
                extractions,
                confidence,
            ),
        );
    }
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
                ...(typeof value.doi === "string" && value.doi
                    ? { doi: value.doi }
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

export function toLedgerExtractions(extractions: unknown): LedgerExtraction[] {
    if (!Array.isArray(extractions)) return [];
    return extractions.flatMap((extraction) => {
        if (!extraction || typeof extraction !== "object") return [];
        const value = extraction as Record<string, unknown>;
        const index = asPositiveIndex(value.index);
        if (index === null) return [];
        return [
            {
                index,
                ...(typeof value.supportingExcerpt === "string"
                    ? { supportingExcerpt: value.supportingExcerpt }
                    : {}),
            },
        ];
    });
}

export function buildClaimLedger(
    report: OpportunityReport,
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
): ClaimLedger {
    const rows: ClaimLedgerRow[] = [];
    const { gaps, problems, venturePotential } = report.sections;

    gaps.forEach((gap, index) => {
        const ordinal = index + 1;
        pushClaimRows(
            rows,
            "gap",
            ordinal,
            ledgerClaimText(claimText(gap.title, gap.description), gap.description, gap.whyItMatters),
            gap.citations,
            papers,
            extractions,
            gap.confidence,
        );
    });

    problems.forEach((problem, index) => {
        const ordinal = index + 1;
        const citations = problem.gapRefs.flatMap((gapRef) =>
            gapCitations(gaps[gapRef - 1]),
        );
        pushClaimRows(
            rows,
            "problem",
            ordinal,
            ledgerClaimText(claimText(problem.title, problem.description), problem.description),
            citations,
            papers,
            extractions,
        );
    });

    venturePotential.forEach((item, index) => {
        const ordinal = index + 1;
        pushClaimRows(
            rows,
            "venture",
            ordinal,
            ledgerClaimText(claimText(item.title, item.thesis), item.thesis, item.feasibilitySignals, item.risks),
            item.citations,
            papers,
            extractions,
        );
    });

    // A paper-level snippet is a verification corpus, never a fallback quote.
    const evidence = report.claimEvidence ?? [];
    for (const row of rows) {
        const matches = evidence.filter((item) =>
            item.rowId === row.id && item.claim === row.claim);
        if (matches.length !== 1 || !row.licenseUrl) continue;
        const quote = normalizeQuote(matches[0].quote);
        const corpus = normalizeQuote(extractions.find((item) =>
            item.index === row.paperIndex)?.supportingExcerpt ?? "");
        if (!quote || quote.length > 1200 || !corpus.includes(quote)) continue;
        row.quote = quote;
    }
    // Fail closed on blanket reuse across distinct claims to the same source.
    const reused = new Set(rows.filter((row) => row.quote && rows.some((other) =>
        other.paperIndex === row.paperIndex && other.claim !== row.claim &&
        other.quote === row.quote)).map((row) => row.id));
    for (const row of rows) if (reused.has(row.id)) row.quote = "";
    return { rows };
}

export function attachClaimLedger(
    report: OpportunityReport,
    papers: LedgerPaper[],
    extractions: LedgerExtraction[],
): OpportunityReport {
    return {
        ...report,
        claimLedger: buildClaimLedger(report, papers, extractions),
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
