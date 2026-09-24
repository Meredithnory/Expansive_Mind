export type CitingWorksSource = "scholar" | "crossref" | "europepmc";

export type CitingWork = {
    title: string;
    authors: string[];
    year?: number;
    url?: string;
    doi?: string;
    clusterId?: string;
};

export type CitingWorksResult = {
    works: CitingWork[];
    total: number;
    hasMore: boolean;
    /** Absolute start index for the next page request, when hasMore. */
    nextOffset?: number;
    source: CitingWorksSource | null;
    unavailableReason?: string;
    /** Honest note when the index reports more than it returned. */
    truncatedNote?: string;
};

/** First-page / per-scroll page size (not a hard list cap). */
export const CITING_WORKS_PAGE_SIZE = 10;
/** Max rows the API will return in a single page. */
export const CITING_WORKS_MAX_PAGE_SIZE = 20;

export type CiteSourcePaper = {
    title: string;
    doi?: string | null;
    authors?: string[];
    year?: number | string | null;
};

export function citingWorksCacheKey(input: {
    doi?: string | null;
    scholarCitesId?: string | null;
}): string | undefined {
    const citesId =
        typeof input.scholarCitesId === "string"
            ? input.scholarCitesId.trim()
            : "";
    if (citesId) return `scholar:${citesId}`;
    const doi =
        typeof input.doi === "string" ? input.doi.trim().toLowerCase() : "";
    if (doi) return `doi:${doi}`;
    return undefined;
}

export function citingWorkIdentity(work: CitingWork): string {
    if (work.doi) return `doi:${work.doi.trim().toLowerCase()}`;
    if (work.clusterId) return `cluster:${work.clusterId.trim()}`;
    return `title:${work.title.trim().toLowerCase()}`;
}

/** Append incoming works, dropping duplicates by DOI / cluster / title. */
export function mergeCitingWorks(
    existing: CitingWork[],
    incoming: CitingWork[],
): CitingWork[] {
    const seen = new Set(existing.map(citingWorkIdentity));
    const merged = [...existing];
    for (const work of incoming) {
        const id = citingWorkIdentity(work);
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push(work);
    }
    return merged;
}

export function citingWorksTruncatedNote(
    loaded: number,
    total: number,
    hasMore: boolean,
): string | undefined {
    if (hasMore || total <= loaded || loaded === 0) return undefined;
    return `Index returned ${loaded.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} citing papers.`;
}

export function parseScholarCitesId(value: unknown): string | undefined {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^[0-9A-Za-z_-]{6,80}$/.test(trimmed)) return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        const asString = String(Math.trunc(value));
        if (/^[0-9]{6,80}$/.test(asString)) return asString;
    }
    return undefined;
}

export function extractScholarCitesId(record: {
    inline_links?: {
        cited_by?: {
            cites_id?: unknown;
            link?: unknown;
        };
    };
}): string | undefined {
    const fromField = parseScholarCitesId(
        record?.inline_links?.cited_by?.cites_id,
    );
    if (fromField) return fromField;

    const link = record?.inline_links?.cited_by?.link;
    if (typeof link !== "string" || !link.trim()) return undefined;
    try {
        const parsed = new URL(link, "https://scholar.google.com");
        return parseScholarCitesId(parsed.searchParams.get("cites"));
    } catch {
        const match = link.match(/[?&]cites=([0-9A-Za-z_-]+)/i);
        return parseScholarCitesId(match?.[1]);
    }
}

export function formatCitingAuthors(authors: string[]): string {
    if (authors.length === 0) return "Authors not listed";
    if (authors.length <= 2) return authors.join(", ");
    return `${authors.slice(0, 2).join(", ")} et al.`;
}

export function extractDoiFromText(value: unknown): string | undefined {
    if (typeof value !== "string" || !value.trim()) return undefined;
    let decoded = value;
    try {
        decoded = decodeURIComponent(value);
    } catch {
        // Keep original.
    }
    const match = decoded.match(/\b10\.\d{4,9}\/[^\s?#&"'<>]+/i);
    if (!match) return undefined;
    return match[0].replace(/[).,;]+$/, "").toLowerCase();
}

export function extractScholarClusterId(value: unknown): string | undefined {
    if (typeof value === "string") {
        const direct = parseScholarCitesId(value);
        if (direct) return direct;
        try {
            const parsed = new URL(value, "https://scholar.google.com");
            return parseScholarCitesId(parsed.searchParams.get("cluster"));
        } catch {
            const match = value.match(/[?&]cluster=([0-9A-Za-z_-]+)/i);
            return parseScholarCitesId(match?.[1]);
        }
    }
    return parseScholarCitesId(value);
}

/** Build an in-app paperchatbot path for a citing work, or null if unresolvable. */
export function buildCitingPaperHref(work: CitingWork): string | null {
    const doi = work.doi || extractDoiFromText(work.url);
    if (doi) {
        const encoded = doi
            .split("/")
            .map((segment) => encodeURIComponent(segment))
            .join("/");
        return `/paperchatbot/springer/${encoded}?idName=doi`;
    }
    const clusterId = work.clusterId || extractScholarClusterId(work.url);
    if (clusterId) {
        return `/paperchatbot/scholar/${encodeURIComponent(clusterId)}`;
    }
    return null;
}
