import "server-only";
import connectDB from "../db/connectDB";
import PaperBrief from "../models/PaperBrief";
import SavedDiscovery from "../models/SavedDiscovery";
import { isValidShareSlug } from "./share-slug";
import { buildPaperPath, type SourceDatabase } from "./paper-sources";
import {
    attachClaimLedger,
    toLedgerExtractions,
    toLedgerPapers,
} from "../api/discover/claim-ledger";
import { buildBriefView, toBriefExtractions, type BriefView } from "./brief-view";
import { parseOpportunityReport } from "../api/discover/synthesize";
import type { ClaimLedger, GapActivity } from "../api/discover/report-types";

export interface SharedBriefPaperRef {
    title: string;
    href: string;
    sourceLabel: string;
    authors: string[];
    date: string;
    /** Set only when the paper studied a narrower group than the question. */
    scope?: string;
}

export interface SharedBrief {
    kind: "paper" | "discovery";
    title: string;
    brief: string;
    authors: string[];
    sourceLabel: string;
    canonicalUrl: string;
    publicationDate: string;
    chatPath: string;
    papers: SharedBriefPaperRef[];
    claimLedger?: ClaimLedger;
    /** Gaps that have a registry check. Grants carry no PI or institution. */
    gapActivity?: SharedGapActivity[];
    /** A discovery brief's structured page. Absent when the report can't be parsed. */
    view?: BriefView;
    slug: string;
    createdAt: Date;
}

export interface SharedGapActivity {
    gapNumber: number;
    title: string;
    activity: GapActivity;
}

export async function findSharedBrief(
    slug: string,
): Promise<SharedBrief | null> {
    if (!isValidShareSlug(slug)) return null;
    await connectDB();

    const paperBrief = await PaperBrief.findOne({ slug }).lean<{
        database: SourceDatabase;
        paperId: string;
        idName: string;
        title: string;
        authors: string[];
        sourceLabel: string;
        canonicalUrl: string;
        publicationDate: string;
        brief: string;
        createdAt: Date;
    } | null>();
    if (paperBrief) {
        return {
            kind: "paper",
            title: paperBrief.title,
            brief: paperBrief.brief,
            authors: paperBrief.authors || [],
            sourceLabel: paperBrief.sourceLabel || "",
            canonicalUrl: paperBrief.canonicalUrl || "",
            publicationDate: paperBrief.publicationDate || "",
            chatPath: buildPaperPath(
                paperBrief.database,
                paperBrief.paperId,
                paperBrief.idName,
            ),
            papers: [],
            slug,
            createdAt: paperBrief.createdAt,
        };
    }

    const discovery = await SavedDiscovery.findOne({
        shareSlug: slug,
    }).lean<{
        question: string;
        brief: string;
        report?: unknown;
        papers: Array<{
            index?: number;
            paperId?: string;
            doi?: string;
            title: string;
            href: string;
            sourceLabel: string;
            authors: string[];
            date: string;
        }>;
        extractions?: unknown[];
        createdAt: Date;
    } | null>();
    if (discovery) {
        const report = parseOpportunityReport(discovery.report);
        const claimLedger = report
            ? attachClaimLedger(
                  report,
                  toLedgerPapers(discovery.papers),
                  toLedgerExtractions(discovery.extractions),
                  discovery.question,
              ).claimLedger
            : undefined;
        const view = report
            ? buildBriefView({
                  slug,
                  question: discovery.question,
                  sections: report.sections,
                  papers: (discovery.papers || []).map((paper) => ({
                      ...paper,
                      authors: paper.authors || [],
                      date: paper.date || "",
                  })),
                  extractions: toBriefExtractions(discovery.extractions),
                  ledger: claimLedger,
              })
            : undefined;
        const scopeByIndex = new Map(
            (view?.papers ?? []).flatMap((paper) =>
                paper.scope ? [[paper.index, paper.scope] as const] : [],
            ),
        );
        const gapActivity: SharedGapActivity[] = (report?.sections.gaps ?? [])
            .map((gap, index) =>
                gap.activity
                    ? { gapNumber: index + 1, title: gap.title, activity: gap.activity }
                    : null,
            )
            .filter((item): item is SharedGapActivity => item !== null);
        return {
            kind: "discovery",
            title: discovery.question,
            brief: discovery.brief,
            authors: [],
            sourceLabel: "Evidence synthesis across papers",
            canonicalUrl: "",
            publicationDate: "",
            chatPath: "/discover",
            papers: (discovery.papers || []).map((paper) => {
                const scope = paper.index
                    ? scopeByIndex.get(paper.index)
                    : undefined;
                return {
                    title: paper.title,
                    href: paper.href,
                    sourceLabel: paper.sourceLabel,
                    authors: paper.authors || [],
                    date: paper.date || "",
                    ...(scope ? { scope } : {}),
                };
            }),
            ...(claimLedger ? { claimLedger } : {}),
            ...(gapActivity.length > 0 ? { gapActivity } : {}),
            ...(view ? { view } : {}),
            slug,
            createdAt: discovery.createdAt,
        };
    }

    return null;
}

// Plain-text preview of the brief for meta descriptions and OG cards.
export function briefPreviewText(brief: string, limit = 200): string {
    const text = brief
        .replace(/^#+\s.*$/gm, " ")
        .replace(/[*_`>#-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    return `${slice.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit)}…`;
}
