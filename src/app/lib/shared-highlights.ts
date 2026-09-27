import mongoose from "mongoose";
import PaperHighlight from "../models/PaperHighlight";
import { loadCachedPaperBySource } from "../api/paper/load-paper";
import type { PaperHighlightLookup } from "./paper-highlights";
import {
    evaluateQuoteEligibility,
    paperHasFullTextBody,
    quoteLicenseFromHome,
} from "./quote-eligibility";

export type SharedHighlightSnapshot = {
    excerpt: string | null;
    sectionTitle: string;
    startLine: number;
    endLine: number;
    color: string;
};

type HighlightDoc = {
    _id: mongoose.Types.ObjectId;
    excerpt: string;
    color: string;
    citation: { sectionTitle: string; startLine: number; endLine: number };
};

/**
 * Snapshot a reader's own highlights on one paper for showing to other
 * people (groups, public forum). Text is kept only when the paper passes the
 * strict quote gate used for claim-ledger quotes; otherwise only the section
 * and line range are kept and readers open the paper to see the passage.
 * Returns null when the paper cannot be loaded.
 */
export async function snapshotSharedHighlights(
    userID: unknown,
    lookup: PaperHighlightLookup,
    highlightIds: string[],
): Promise<{
    paperTitle: string;
    quotable: boolean;
    highlights: SharedHighlightSnapshot[];
} | null> {
    const ids = highlightIds.filter((id) => mongoose.isValidObjectId(id));
    const docs = ids.length
        ? ((await PaperHighlight.find({
              _id: { $in: ids },
              userID,
              primarySource: lookup.primarySource,
              paperId: lookup.paperId,
              idName: lookup.idName,
          })
              .sort({ createdAt: 1 })
              .lean()) as unknown as HighlightDoc[])
        : [];

    const loaded = await loadCachedPaperBySource(
        lookup.database,
        lookup.paperId,
        lookup.idName,
    ).catch(() => null);
    const paper = loaded?.value;
    if (!paper) return null;

    const licenses = quoteLicenseFromHome(paper.access);
    const quotable = evaluateQuoteEligibility({
        source: paper.source || lookup.database,
        database: lookup.database,
        contentLabel: paper.contentLabel,
        hasFullTextBody: paperHasFullTextBody(paper),
        rawLicense: licenses.rawLicense,
        licenseUrl: licenses.licenseUrl,
    }).allowed;

    return {
        paperTitle: String(paper.title || "Untitled paper").slice(0, 500),
        quotable,
        highlights: docs.map((doc) => ({
            excerpt: quotable ? doc.excerpt : null,
            sectionTitle: doc.citation.sectionTitle,
            startLine: doc.citation.startLine,
            endLine: doc.citation.endLine,
            color: doc.color || "pink",
        })),
    };
}
