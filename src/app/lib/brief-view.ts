// What a shared discovery brief shows, built from the saved report: the
// summary with paper chips that open the reader at the cited sentence, the
// gaps, the papers, and which of them studied a narrower group than asked.
import type {
    ClaimLedger,
    EvidenceAnchor,
    OpportunityReportSections,
    ReportConfidence,
} from "../api/discover/report-types";
import { splitCitedText } from "./cited-text";
import { gapActivitySummary } from "./gap-activity";
import { evidenceFocusHref, gapEvidenceId, isEvidenceAnchor } from "./paper-evidence";
import { narrowerScope } from "./paper-scope";
import { withBriefOrigin } from "./paper-sources";

export type BriefPaperInput = {
    index?: number;
    title: string;
    href: string;
    sourceLabel: string;
    authors: string[];
    date: string;
};

type BriefEvidence = { id: string; quote?: string; anchor?: EvidenceAnchor };

export type BriefExtractionInput = {
    index: number;
    population?: string;
    evidence: BriefEvidence[];
};

export type BriefSegment =
    | { type: "text"; value: string }
    | { type: "cite"; index: number; label: string; href: string };

export interface BriefPaperView {
    index: number;
    title: string;
    href: string;
    meta: string;
    /** Set only when the paper studied a narrower group than the question. */
    scope?: string;
    /** A ledger claim quotes this paper. */
    quoted: boolean;
}

export interface BriefGapView {
    number: number;
    title: string;
    description: BriefSegment[];
    confidence: ReportConfidence;
    papers: Array<{ index: number; href: string }>;
    activity: string | null;
}

export interface BriefView {
    summary: BriefSegment[];
    /** Papers the summary cites that studied a narrower group. */
    narrowNotes: Array<{ index: number; scope: string }>;
    gaps: BriefGapView[];
    papers: BriefPaperView[];
    claimCount: number;
    quotedCount: number;
}

/** Stored extractions, keeping only what the brief reads. */
export function toBriefExtractions(extractions: unknown): BriefExtractionInput[] {
    if (!Array.isArray(extractions)) return [];
    return extractions.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const value = raw as Record<string, unknown>;
        if (typeof value.index !== "number" || value.index < 1) return [];
        const evidence = Array.isArray(value.evidence)
            ? value.evidence.flatMap((item): BriefEvidence[] => {
                  if (!item || typeof item !== "object") return [];
                  const row = item as Record<string, unknown>;
                  if (typeof row.id !== "string" || !row.id) return [];
                  return [
                      {
                          id: row.id,
                          ...(typeof row.quote === "string" && row.quote
                              ? { quote: row.quote }
                              : {}),
                          ...(isEvidenceAnchor(row.anchor) ? { anchor: row.anchor } : {}),
                      },
                  ];
              })
            : [];
        return [
            {
                index: value.index,
                ...(typeof value.population === "string" && value.population
                    ? { population: value.population }
                    : {}),
                evidence,
            },
        ];
    });
}

function paperMeta(paper: BriefPaperInput) {
    const authors = paper.authors.slice(0, 3).join(", ");
    return [
        paper.authors.length > 3 ? `${authors} et al.` : authors,
        paper.sourceLabel,
        paper.date,
    ]
        .filter(Boolean)
        .join(" · ");
}

export function buildBriefView(input: {
    slug: string;
    question: string;
    sections: OpportunityReportSections;
    papers: BriefPaperInput[];
    extractions: BriefExtractionInput[];
    ledger?: ClaimLedger;
}): BriefView {
    const { slug, question, sections } = input;
    const papers = input.papers.flatMap((paper, position) => {
        const index = paper.index ?? position + 1;
        return paper.href ? [{ ...paper, index }] : [];
    });
    const paperByIndex = new Map(papers.map((paper) => [paper.index, paper]));
    const extractionByIndex = new Map(input.extractions.map((item) => [item.index, item]));
    const paperCount = Math.max(0, ...papers.map((paper) => paper.index));

    const evidenceFor = (paperIndex: number, id: string | null | undefined) =>
        id ? extractionByIndex.get(paperIndex)?.evidence.find((item) => item.id === id) : undefined;

    const readerHref = (paperIndex: number, evidenceId: string | null | undefined, claim: string) => {
        const paper = paperByIndex.get(paperIndex);
        if (!paper) return null;
        return withBriefOrigin(
            evidenceFocusHref(paper.href, evidenceFor(paperIndex, evidenceId)),
            slug,
            claim,
        );
    };

    // Chips in report prose, each opening the reader at the sentence it cites.
    const cited = (text: string, key: string): BriefSegment[] => {
        const refs = sections.citationEvidence?.[key] ?? [];
        let chip = -1;
        let claim = "";
        return splitCitedText(text, paperCount).flatMap((segment): BriefSegment[] => {
            if (segment.type === "text") {
                if (segment.value.trim().length > 2) {
                    claim = segment.value.split(/(?<=[.!?])\s+/).filter((part) => part.trim()).pop() ?? claim;
                }
                return [segment];
            }
            chip += 1;
            const href = readerHref(segment.index, refs[chip], claim);
            return href
                ? [{ type: "cite", index: segment.index, label: segment.label, href }]
                : [{ type: "text", value: segment.label }];
        });
    };

    const summaryText =
        sections.stateOfScience ||
        "The available papers did not support a confident summary of the state of the science.";
    const summary = cited(summaryText, "stateOfScience");

    const scopeByIndex = new Map(
        papers.flatMap((paper) => {
            const scope = narrowerScope(question, extractionByIndex.get(paper.index)?.population);
            return scope ? [[paper.index, scope] as const] : [];
        }),
    );
    const summaryCites = [
        ...new Set(
            summary.flatMap((segment) => (segment.type === "cite" ? [segment.index] : [])),
        ),
    ];
    const narrowNotes = summaryCites.flatMap((index) => {
        const scope = scopeByIndex.get(index);
        return scope ? [{ index, scope }] : [];
    });

    const gaps = sections.gaps.map((gap, position) => ({
        number: position + 1,
        title: gap.title,
        description: cited(gap.description, `gaps.${position}.description`),
        confidence: gap.confidence,
        papers: [...new Set(gap.citations)].flatMap((index) => {
            const href = readerHref(
                index,
                gapEvidenceId(sections.citationEvidence, position, index),
                gap.title,
            );
            return href ? [{ index, href }] : [];
        }),
        activity: gapActivitySummary(gap.activity),
    }));

    const rows = input.ledger?.rows ?? [];
    const quotedPapers = new Set(
        rows.flatMap((row) =>
            row.sources.flatMap((source) => (source.quote ? [source.paperIndex] : [])),
        ),
    );

    return {
        summary,
        narrowNotes,
        gaps,
        papers: papers.map((paper) => {
            const scope = scopeByIndex.get(paper.index);
            return {
                index: paper.index,
                title: paper.title,
                href: withBriefOrigin(paper.href, slug),
                meta: paperMeta(paper),
                ...(scope ? { scope } : {}),
                quoted: quotedPapers.has(paper.index),
            };
        }),
        claimCount: rows.length,
        quotedCount: rows.filter((row) => row.sources.some((source) => source.quote)).length,
    };
}
