import {
    buildPaperPath,
    getSourceByLabel,
    type SourceDatabase,
} from "./paper-sources";
import type { PaperHighlightRecord } from "./paper-highlights";

export type HighlightNoteRow = PaperHighlightRecord & {
    primarySource: string;
    paperId: string;
    idName: string;
};

export interface HighlightNotesPaper {
    key: string;
    database: SourceDatabase;
    primarySource: string;
    paperId: string;
    idName: string;
    title: string;
    href: string;
    latestAt: string;
    highlights: PaperHighlightRecord[];
}

export function highlightPaperKey(
    row: Pick<HighlightNoteRow, "primarySource" | "paperId" | "idName">,
) {
    return `${row.primarySource}|${row.idName}|${row.paperId}`;
}

/**
 * Group a reader's highlights by paper. Papers are ordered by their newest
 * highlight; highlights inside a paper keep reading order (oldest first) so
 * the notes read top to bottom like the paper. Rows from an unknown source
 * are skipped because they cannot link back to a reader page.
 */
export function groupHighlightsByPaper(
    rows: HighlightNoteRow[],
    titles: ReadonlyMap<string, string> = new Map(),
): HighlightNotesPaper[] {
    const papers = new Map<string, HighlightNotesPaper>();
    for (const row of rows) {
        const source = getSourceByLabel(row.primarySource);
        if (!source) continue;
        const key = highlightPaperKey(row);
        let paper = papers.get(key);
        if (!paper) {
            paper = {
                key,
                database: source.database,
                primarySource: row.primarySource,
                paperId: row.paperId,
                idName: row.idName,
                title: titles.get(key) || `${source.label} · ${row.paperId}`,
                href: buildPaperPath(source.database, row.paperId, row.idName),
                latestAt: row.createdAt || "",
                highlights: [],
            };
            papers.set(key, paper);
        }
        paper.highlights.push({
            id: row.id,
            excerpt: row.excerpt,
            citation: row.citation,
            color: row.color,
            createdAt: row.createdAt,
        });
        if ((row.createdAt || "") > paper.latestAt) {
            paper.latestAt = row.createdAt || "";
        }
    }
    for (const paper of papers.values()) {
        paper.highlights.sort((a, b) =>
            (a.createdAt || "").localeCompare(b.createdAt || ""),
        );
    }
    return [...papers.values()].sort((a, b) =>
        b.latestAt.localeCompare(a.latestAt),
    );
}
