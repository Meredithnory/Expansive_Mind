import {
    makePaperLocator,
    type PaperLocator,
    type SourceDatabase,
} from "./paper-sources";

export interface CitationDraft {
    title?: string | null;
    authors?: ReadonlyArray<string | null | undefined> | null;
    doi?: string | null;
    date?: string | null;
    url?: string | null;
}

export interface SourceCitation {
    title: string;
    authors: string[];
    doi?: string;
    date?: string;
    url?: string;
}

const DOI_PREFIX = /^(?:doi:\s*|https?:\/\/doi\.org\/)/i;

export function normalizeDoi(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().replace(DOI_PREFIX, "").replace(/^\/+/, "");
    if (!/^10\.\S+\/\S+$/i.test(trimmed)) return null;
    return trimmed.replace(/[)\].,;]+$/, "");
}

export function normalizePmcid(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    const digits = trimmed.replace(/^PMC/i, "").replace(/\D/g, "");
    return digits || null;
}

export function normalizeCitation(draft: CitationDraft): SourceCitation {
    const authors = (draft.authors ?? [])
        .map((author) => (typeof author === "string" ? author.trim() : ""))
        .filter(Boolean);
    const doi = normalizeDoi(draft.doi);
    const date = draft.date?.trim() || undefined;
    const url = draft.url?.trim() || undefined;
    const title = draft.title?.trim() || "Untitled";
    return {
        title,
        authors,
        ...(doi ? { doi } : {}),
        ...(date ? { date } : {}),
        ...(url ? { url } : {}),
    };
}

export function mergeCitations(
    base: SourceCitation,
    refinement: SourceCitation,
): SourceCitation {
    return normalizeCitation({
        title: refinement.title !== "Untitled" ? refinement.title : base.title,
        authors:
            refinement.authors.length > 0 ? refinement.authors : base.authors,
        doi: refinement.doi || base.doi,
        date: refinement.date || base.date,
        url: refinement.url || base.url,
    });
}

export function workKey(identity: {
    doi?: string | null;
    locator?: PaperLocator | null;
}): string {
    const doi = normalizeDoi(identity.doi);
    if (doi) return `doi:${doi.toLowerCase()}`;
    const locator = identity.locator;
    if (!locator) return "";
    return `${locator.database}:${locator.paperId.trim().toLowerCase()}`;
}

export function doiUrl(doi: string): string {
    return `https://doi.org/${doi}`;
}

export function locatorFromPmcid(pmcid: string): PaperLocator | null {
    const id = normalizePmcid(pmcid);
    if (!id) return null;
    return makePaperLocator("nih", id, "pmcid");
}

export function locatorFromDoiReader(
    database: SourceDatabase,
    doi: string,
): PaperLocator | null {
    const normalized = normalizeDoi(doi);
    if (!normalized || database === "nih") return null;
    return makePaperLocator(database, normalized, "doi");
}
