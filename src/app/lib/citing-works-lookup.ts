import "server-only";
import { cached } from "./provider-cache";
import { normalizePaperDoi } from "./paper-impact";
import { consumeRateLimit } from "./rate-limit";
import {
    CITING_WORKS_MAX_PAGE_SIZE,
    CITING_WORKS_PAGE_SIZE,
    citingWorksCacheKey,
    citingWorksTruncatedNote,
    extractDoiFromText,
    extractScholarCitesId,
    extractScholarClusterId,
    parseScholarCitesId,
    type CitingWork,
    type CitingWorksResult,
    type CitingWorksSource,
} from "./citing-works";

const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const SERPAPI_URL = "https://serpapi.com/search.json";
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function yearFromParts(parts: unknown): number | undefined {
    if (!Array.isArray(parts) || parts.length === 0) return undefined;
    const year = Number(parts[0]);
    return Number.isFinite(year) && year >= 1000 && year <= 3000
        ? Math.trunc(year)
        : undefined;
}

async function enforceOutboundLimit(
    scope: string,
    limit: number,
    windowMs: number,
) {
    const result = await consumeRateLimit({
        scope: `outbound-${scope}`,
        identity: "global",
        limit,
        windowMs,
    });
    if (!result.allowed) throw new Error(`${scope} request limit reached.`);
}

function mapScholarWork(item: unknown): CitingWork | null {
    const row = record(item);
    const title = asString(row.title);
    if (!title) return null;

    const authors: string[] = [];
    const authorList = record(row.publication_info).authors;
    if (Array.isArray(authorList)) {
        for (const author of authorList) {
            const name = asString(record(author).name);
            if (name) authors.push(name);
        }
    }
    if (authors.length === 0) {
        const summary = asString(record(row.publication_info).summary);
        const beforeDash = summary.split(" - ")[0] || "";
        for (const name of beforeDash.split(",")) {
            const trimmed = name.trim();
            if (trimmed) authors.push(trimmed);
        }
    }

    const yearRaw = record(row.publication_info).year;
    const year =
        typeof yearRaw === "number"
            ? yearFromParts([yearRaw])
            : yearFromParts([Number.parseInt(asString(yearRaw), 10)]);

    const resources = Array.isArray(row.resources) ? row.resources : [];
    const url =
        asString(row.link) || asString(record(resources[0]).link);
    const clusterId =
        extractScholarClusterId(
            record(record(row.inline_links).versions).cluster_id,
        ) ||
        extractScholarClusterId(row.result_id) ||
        extractScholarClusterId(url);
    const doi =
        extractDoiFromText(url) ||
        extractDoiFromText(asString(record(resources[0]).link)) ||
        extractDoiFromText(asString(record(row.publication_info).summary));

    return {
        title,
        authors,
        ...(year != null ? { year } : {}),
        ...(url ? { url } : {}),
        ...(clusterId ? { clusterId } : {}),
        ...(doi ? { doi } : {}),
    };
}

function finalizePage(input: {
    works: CitingWork[];
    total: number;
    offset: number;
    pageSize: number;
    rawReturned: number;
    source: CitingWorksSource;
}): CitingWorksResult {
    const { works, offset, pageSize, rawReturned, source } = input;
    const total = Math.max(input.total, offset + works.length);
    const reachedTotal = total > 0 && offset + works.length >= total;
    const fullPage = rawReturned >= pageSize && works.length > 0;
    const hasMore = !reachedTotal && fullPage;
    const nextOffset = hasMore ? offset + works.length : undefined;
    const truncatedNote = citingWorksTruncatedNote(
        offset + works.length,
        total,
        hasMore,
    );

    return {
        works,
        total,
        hasMore,
        ...(nextOffset != null ? { nextOffset } : {}),
        source,
        ...(truncatedNote ? { truncatedNote } : {}),
    };
}

function mapEuropePmcCitation(item: unknown): CitingWork | null {
    const row = record(item);
    const title = asString(row.title);
    if (!title) return null;

    const authors = asString(row.authorString)
        .replace(/\.\s*$/, "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

    const year = Number(row.pubYear);
    const validYear =
        Number.isFinite(year) && year >= 1000 && year <= 3000
            ? Math.trunc(year)
            : undefined;
    const doi = normalizePaperDoi(row.doi);
    const id = asString(row.id);
    const source = asString(row.source);
    const url =
        (id && source
            ? `https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(id)}`
            : "") || (doi ? `https://doi.org/${doi}` : "");

    return {
        title,
        authors,
        ...(validYear != null ? { year: validYear } : {}),
        ...(url ? { url } : {}),
        ...(doi ? { doi } : {}),
    };
}

async function resolveEuropePmcRecord(
    doi: string,
): Promise<{ source: string; id: string } | null> {
    const params = new URLSearchParams({
        query: `DOI:${doi}`,
        format: "json",
        resultType: "lite",
        pageSize: "1",
    });
    const response = await fetch(`${EUROPE_PMC}/search?${params}`, {
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = record(await response.json());
    const results = record(data.resultList).result;
    const first = Array.isArray(results) ? record(results[0]) : null;
    if (!first) return null;
    const id = asString(first.id);
    const source = asString(first.source);
    return id && source ? { source, id } : null;
}

async function fetchEuropePmcCitingWorks(
    doi: string,
    limit: number,
    offset: number,
): Promise<CitingWorksResult> {
    await enforceOutboundLimit("europepmc", 40, 60_000);
    const recordId = await resolveEuropePmcRecord(doi);
    if (!recordId) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: "europepmc",
            unavailableReason:
                "Europe PMC has no citing-paper list for this DOI.",
        };
    }

    const page = Math.floor(offset / limit) + 1;
    const params = new URLSearchParams({
        format: "json",
        page: String(page),
        pageSize: String(limit),
    });
    const response = await fetch(
        `${EUROPE_PMC}/${encodeURIComponent(recordId.source)}/${encodeURIComponent(recordId.id)}/citations?${params}`,
        { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: "europepmc",
            unavailableReason:
                "Europe PMC did not return the citing papers for this DOI.",
        };
    }

    const data = record(await response.json());
    const items = record(data.citationList).citation;
    const citations = Array.isArray(items) ? items : items ? [items] : [];
    const works = citations
        .map(mapEuropePmcCitation)
        .filter((work): work is CitingWork => Boolean(work));
    const totalReported = Number(data.hitCount);
    const total = Number.isFinite(totalReported)
        ? Math.max(totalReported, offset + works.length)
        : offset + works.length;

    if (offset === 0 && works.length === 0) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: "europepmc",
            unavailableReason:
                "Europe PMC has a record for this DOI, but no citing papers to list.",
        };
    }

    return finalizePage({
        works,
        total,
        offset,
        pageSize: limit,
        rawReturned: citations.length,
        source: "europepmc",
    });
}

async function fetchScholarCitingWorks(
    citesId: string,
    limit: number,
    offset: number,
): Promise<CitingWorksResult> {
    if (!SERPAPI_KEY) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: "scholar",
            unavailableReason:
                "Google Scholar citing papers require SerpApi, which is not configured.",
        };
    }

    await enforceOutboundLimit("serpapi", 60, 60_000);
    // SerpApi Scholar typically returns up to 10–20 per page; use start for paging.
    const params = new URLSearchParams({
        engine: "google_scholar",
        cites: citesId,
        api_key: SERPAPI_KEY,
        num: String(Math.min(limit, 20)),
        start: String(offset),
        hl: "en",
    });

    const response = await fetch(`${SERPAPI_URL}?${params}`, {
        signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: "scholar",
            unavailableReason:
                "Google Scholar (via SerpApi) did not return citing papers for this result.",
        };
    }

    const data = record(await response.json());
    const organic = Array.isArray(data.organic_results)
        ? data.organic_results
        : [];
    const works = organic
        .map(mapScholarWork)
        .filter((work): work is CitingWork => Boolean(work));

    const totalRaw =
        data.search_information &&
        record(data.search_information).total_results;
    const totalParsed =
        typeof totalRaw === "number"
            ? totalRaw
            : Number.parseInt(asString(totalRaw).replace(/,/g, ""), 10);
    const total = Number.isFinite(totalParsed)
        ? Math.max(totalParsed, offset + works.length)
        : offset + works.length;

    if (offset === 0 && works.length === 0) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: "scholar",
            unavailableReason:
                "Google Scholar reported citations, but SerpApi did not return the citing-papers list.",
        };
    }

    return finalizePage({
        works,
        total,
        offset,
        pageSize: Math.min(limit, 20),
        rawReturned: organic.length,
        source: "scholar",
    });
}

function emptyUnavailable(reason: string): CitingWorksResult {
    return {
        works: [],
        total: 0,
        hasMore: false,
        source: null,
        unavailableReason: reason,
    };
}

export async function lookupCitingWorks(input: {
    doi?: string | null;
    scholarCitesId?: string | null;
    limit?: number;
    offset?: number;
}): Promise<CitingWorksResult> {
    const limit = Math.min(
        Math.max(input.limit ?? CITING_WORKS_PAGE_SIZE, 1),
        CITING_WORKS_MAX_PAGE_SIZE,
    );
    const offset = Math.max(
        0,
        Number.isFinite(input.offset) ? Math.trunc(input.offset as number) : 0,
    );
    const citesId = parseScholarCitesId(input.scholarCitesId);
    const doi = normalizePaperDoi(input.doi);
    const cacheKey = citingWorksCacheKey({
        doi,
        scholarCitesId: citesId,
    });

    if (!cacheKey) {
        return emptyUnavailable(
            "Citing papers are not available for this result. No Scholar cites id or DOI was present to look them up.",
        );
    }

    try {
        const { value } = await cached({
            namespace: "citing-works-v4",
            key: `${cacheKey}:offset:${offset}:limit:${limit}`,
            ttlSeconds: CACHE_TTL_SECONDS,
            load: async () => {
                if (citesId) {
                    return fetchScholarCitingWorks(citesId, limit, offset);
                }
                if (doi) {
                    return fetchEuropePmcCitingWorks(doi, limit, offset);
                }
                return emptyUnavailable(
                    "Citing papers are not available for this result.",
                );
            },
        });
        return value;
    } catch (error) {
        console.warn("Citing works lookup failed", error);
        const source: CitingWorksSource | null = citesId
            ? "scholar"
            : doi
              ? "crossref"
              : null;
        return {
            works: [],
            total: 0,
            hasMore: false,
            source,
            unavailableReason: citesId
                ? "Google Scholar citing papers could not be loaded right now."
                : "Citing papers could not be loaded right now.",
        };
    }
}

export { extractScholarCitesId, parseScholarCitesId };
