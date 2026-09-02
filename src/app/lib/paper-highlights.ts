import type { PaperCitation } from "./paper-citation";
import {
    getSourceByDatabase,
    normalizeStoredPaperId,
    type SourceDatabase,
} from "./paper-sources";
import { MAX_REGION_EXCERPT_CHARS } from "./region-capture";

export const MAX_HIGHLIGHTS_PER_PAPER = 50;

export interface PaperHighlightRecord {
    id: string;
    excerpt: string;
    citation: PaperCitation;
    createdAt?: string;
}

export interface PaperHighlightLookup {
    database: SourceDatabase;
    primarySource: string;
    paperId: string;
    idName: string;
}

export function parseHighlightLookup(input: {
    database?: unknown;
    paperId?: unknown;
    idName?: unknown;
}): PaperHighlightLookup | null {
    const database =
        typeof input.database === "string" ? input.database.trim() : "";
    const paperId =
        typeof input.paperId === "string" ? input.paperId.trim() : "";
    const source = getSourceByDatabase(database);
    const idName =
        typeof input.idName === "string" && input.idName.trim()
            ? input.idName.trim()
            : source?.defaultIdName;
    if (!source || !paperId || paperId.length > 300 || !idName) {
        return null;
    }
    return {
        database: source.database,
        primarySource: source.label,
        paperId: normalizeStoredPaperId(paperId),
        idName,
    };
}

export function parseHighlightCitation(input: unknown): PaperCitation | null {
    if (!input || typeof input !== "object") return null;
    const value = input as Record<string, unknown>;
    const sectionTitle =
        typeof value.sectionTitle === "string"
            ? value.sectionTitle.trim().slice(0, 200)
            : "";
    const startLine = Number(value.startLine);
    const endLine = Number(value.endLine);
    const lines = Array.isArray(value.lines)
        ? value.lines
              .filter((line): line is string => typeof line === "string")
              .map((line) => line.replace(/\s+/g, " ").trim().slice(0, 200))
              .filter(Boolean)
              .slice(0, 80)
        : [];
    if (
        !sectionTitle ||
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine < 1 ||
        endLine < startLine ||
        endLine > 100_000 ||
        lines.length === 0
    ) {
        return null;
    }
    return { sectionTitle, startLine, endLine, lines };
}

export function parseHighlightExcerpt(input: unknown) {
    if (typeof input !== "string") return "";
    return input.replace(/\s+/g, " ").trim().slice(0, MAX_REGION_EXCERPT_CHARS);
}

export function serializePaperHighlight(doc: {
    _id: { toString(): string };
    excerpt: string;
    citation: PaperCitation;
    createdAt?: Date;
}): PaperHighlightRecord {
    return {
        id: doc._id.toString(),
        excerpt: doc.excerpt,
        citation: {
            sectionTitle: doc.citation.sectionTitle,
            startLine: doc.citation.startLine,
            endLine: doc.citation.endLine,
            lines: [...doc.citation.lines],
        },
        createdAt: doc.createdAt?.toISOString(),
    };
}

export async function fetchPaperHighlights(lookup: {
    database: string;
    paperId: string;
    idName: string;
}): Promise<PaperHighlightRecord[]> {
    const params = new URLSearchParams({
        database: lookup.database,
        paperId: lookup.paperId,
        idName: lookup.idName,
    });
    const response = await fetch(`/api/highlights?${params}`, {
        cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { highlights?: unknown };
    if (!Array.isArray(data.highlights)) return [];
    return data.highlights.filter((item): item is PaperHighlightRecord => {
        if (!item || typeof item !== "object") return false;
        const record = item as PaperHighlightRecord;
        return (
            typeof record.id === "string" &&
            typeof record.excerpt === "string" &&
            Boolean(parseHighlightCitation(record.citation))
        );
    });
}

export async function savePaperHighlight(input: {
    database: string;
    paperId: string;
    idName: string;
    excerpt: string;
    citation: PaperCitation;
}): Promise<PaperHighlightRecord | null> {
    const response = await fetch("/api/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { highlight?: PaperHighlightRecord };
    return data.highlight?.id ? data.highlight : null;
}

export async function deletePaperHighlight(highlightId: string) {
    await fetch("/api/highlights", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
    });
}
