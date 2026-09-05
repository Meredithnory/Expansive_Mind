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

function excerptByIndex(
    extractions: LedgerExtraction[],
    index: number,
): string {
    const extraction = extractions.find((item) => item.index === index);
    return trimmed(extraction?.supportingExcerpt);
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
    return trimmed(row.quote).length > 0 && hasResolvableCitation(row);
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
    return {
        id: `${kind}-${ordinal}-p${paperIndex}`,
        kind,
        claim,
        paperIndex,
        ...(paperId ? { paperId } : {}),
        ...(doi ? { doi } : {}),
        ...(href ? { href } : {}),
        quote: excerptByIndex(extractions, paperIndex),
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

function citationIndexes(citations: number[], papers: LedgerPaper[]): number[] {
    const known = new Set(papers.map((paper) => paper.index));
    return [...new Set(citations.filter((index) => known.has(index)))];
}

function gapCitations(gap: ReportGap | undefined, papers: LedgerPaper[]): number[] {
    if (!gap) return [];
    return citationIndexes(gap.citations, papers);
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
    const resolved = citationIndexes(citations, papers);
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
            claimText(gap.title, gap.description),
            gap.citations,
            papers,
            extractions,
            gap.confidence,
        );
    });

    problems.forEach((problem, index) => {
        const ordinal = index + 1;
        const citations = problem.gapRefs.flatMap((gapRef) =>
            gapCitations(gaps[gapRef - 1], papers),
        );
        pushClaimRows(
            rows,
            "problem",
            ordinal,
            claimText(problem.title, problem.description),
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
            claimText(item.title, item.thesis),
            item.citations,
            papers,
            extractions,
        );
    });

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
            ? `${SHARE_LOCKED_ERROR} 1 still needs a quote or paper link.`
            : `${SHARE_LOCKED_ERROR} ${n} still need a quote or paper link.`;
    }
    return "Share stays locked until this brief has sourced claims.";
}
