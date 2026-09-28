import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import PaperHighlight from "../../../models/PaperHighlight";
import { consumeRateLimit } from "../../../lib/rate-limit";
import { abstractToText } from "../../../lib/abstract-text";
import { getSourceByLabel } from "../../../lib/paper-sources";
import { serializePaperHighlight } from "../../../lib/paper-highlights";
import {
    groupHighlightsByPaper,
    highlightPaperKey,
    type HighlightNoteRow,
} from "../../../lib/highlight-notes";
import { getNIHPaperResults } from "../../search/utils";
import { getSpringerPaperMetadata } from "../../paper/utils";

const MAX_NOTES = 500;

type HighlightDoc = Parameters<typeof serializePaperHighlight>[0] & {
    primarySource: string;
    paperId: string;
    idName: string;
};

// Titles come from the same metadata lookups the Library uses. Scholar is
// skipped on purpose: each lookup spends a SerpApi credit, and the fallback
// label still links to the paper.
async function lookupTitles(rows: HighlightNoteRow[]) {
    const titles = new Map<string, string>();
    const nih = new Map<string, HighlightNoteRow>();
    const springer = new Map<string, HighlightNoteRow>();
    for (const row of rows) {
        const database = getSourceByLabel(row.primarySource)?.database;
        if (database === "nih") nih.set(row.paperId, row);
        if (database === "springer") springer.set(row.paperId, row);
    }
    const [nihResults, springerResults] = await Promise.all([
        nih.size > 0
            ? getNIHPaperResults(
                  [...nih.keys()].map((id) => ({ id, matchTier: "title" as const })),
              ).catch(() => [])
            : Promise.resolve([]),
        springer.size > 0
            ? getSpringerPaperMetadata([...springer.keys()]).catch(() => [])
            : Promise.resolve([]),
    ]);
    const setTitle = (row: HighlightNoteRow | undefined, raw: unknown) => {
        const title = abstractToText(raw as string).trim();
        if (row && title) titles.set(highlightPaperKey(row), title);
    };
    for (const paper of nihResults as Array<{ pmcid?: string; title?: unknown }>) {
        setTitle(nih.get(String(paper.pmcid)), paper.title);
    }
    for (const paper of springerResults as Array<{ paperId?: string; title?: unknown }>) {
        setTitle(springer.get(String(paper.paperId)), paper.title);
    }
    return titles;
}

export const GET = withAuth(async (request: NextRequest) => {
    const rateLimit = await consumeRateLimit({
        scope: "highlights-notes",
        identity: request.user._id.toString(),
        limit: 20,
        windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many highlight requests. Please try again shortly." },
            {
                status: 429,
                headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
            },
        );
    }

    const docs = (await PaperHighlight.find({ userID: request.user._id })
        .sort({ createdAt: -1 })
        .limit(MAX_NOTES)
        .lean()) as unknown as HighlightDoc[];

    const rows: HighlightNoteRow[] = docs.map((doc) => ({
        ...serializePaperHighlight(doc),
        primarySource: doc.primarySource,
        paperId: doc.paperId,
        idName: doc.idName,
    }));
    const titles = await lookupTitles(rows);

    return NextResponse.json(
        {
            papers: groupHighlightsByPaper(rows, titles),
            total: rows.length,
            truncated: docs.length === MAX_NOTES,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
