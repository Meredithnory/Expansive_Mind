import convert from "xml-js";
import { evaluateContentAccess } from "../../lib/content-access-policy";
import { abstractToText } from "../../lib/abstract-text";
import { consumeRateLimit } from "../../lib/rate-limit";
import {
    buildSpringerFallbackQuery,
    buildSpringerSearchQuery,
    getMeaningfulSearchTerms,
} from "./springer-query";

export {
    buildSpringerFallbackQuery,
    buildSpringerSearchQuery,
    getMeaningfulSearchTerms,
} from "./springer-query";
//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NIH_API_KEY = process.env.API_KEY;
const NCBI_EMAIL = process.env.NCBI_EMAIL;
const NCBI_TOOL = process.env.NCBI_TOOL || "ExpansiveMind";
const SPRINGER_API_URL = "https://api.springernature.com/openaccess/json";
const SPRINGER_API_KEY = process.env.SPRINGER_API_KEY;
const SERPAPI_URL = "https://serpapi.com/search.json";
const SERPAPI_KEY = process.env.SERPAPI_KEY;

const RETMAX = 10;
const SPRINGER_CACHE_SECONDS = 24 * 60 * 60;

export const isNihApiConfigured = () =>
    Boolean(NIH_API_KEY && NCBI_EMAIL);

const addNcbiIdentification = (params: URLSearchParams) => {
    if (!NCBI_EMAIL) {
        throw new Error(
            "NCBI_EMAIL is required so NCBI can identify this application.",
        );
    }
    params.set("tool", NCBI_TOOL);
    params.set("email", NCBI_EMAIL);
    if (NIH_API_KEY) params.set("api_key", NIH_API_KEY);
};

const enforceOutboundLimit = async (
    scope: string,
    limit: number,
    windowMs: number,
) => {
    const result = await consumeRateLimit({
        scope: `outbound-${scope}`,
        identity: "global",
        limit,
        windowMs,
    });
    if (!result.allowed) throw new Error(`${scope} request limit reached.`);
};

export type MatchTier = "title" | "abstract" | "body";

export interface TieredPaperId {
    id: string;
    matchTier: MatchTier;
}

const parseEsearchIds = (dataAsJSON: any): string[] => {
    const articleOrArticles = dataAsJSON.eSearchResult.IdList?.Id;
    if (!articleOrArticles) {
        return [];
    }
    if (!Array.isArray(articleOrArticles)) {
        return [articleOrArticles._text];
    }
    return articleOrArticles.map((a: any) => a._text);
};

const runNIHEsearch = async (
    term: string,
    retstart: number,
    retmax: number,
    sort: "relevance" | "pubdate" = "relevance",
): Promise<{ count: number; ids: string[] }> => {
    const params = new URLSearchParams();
    params.append("db", "pmc");
    addNcbiIdentification(params);
    params.append("term", term);
    params.append("retstart", retstart.toString());
    params.append("retmax", retmax.toString());
    params.append("usehistory", "y");
    params.append("sort", sort);

    await enforceOutboundLimit("ncbi", NIH_API_KEY ? 9 : 2, 1_000);
    const res = await fetch(`${NIH_API_URL}/esearch.fcgi?${params}`);
    const data = await res.text();
    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));

    const count = Number.parseInt(dataAsJSON.eSearchResult.Count._text, 10) || 0;
    const ids = retmax > 0 ? parseEsearchIds(dataAsJSON) : [];

    return { count, ids };
};

export { abstractToText } from "../../lib/abstract-text";

export const inferMatchTier = (
    searchValue: string,
    title?: string | null,
    abstract?: string | string[] | Record<string, unknown> | null,
): MatchTier => {
    const query = searchValue.toLowerCase().trim();
    const queryTerms = getMeaningfulSearchTerms(searchValue);
    const titleText = title?.toLowerCase() || "";
    const titleCoverage =
        queryTerms.length > 0
            ? queryTerms.filter((term) => titleText.includes(term)).length /
              queryTerms.length
            : 0;

    if (titleText.includes(query) || titleCoverage >= 0.75) {
        return "title";
    }

    const abstractText = abstractToText(abstract).toLowerCase();
    const abstractCoverage =
        queryTerms.length > 0
            ? queryTerms.filter((term) => abstractText.includes(term)).length /
              queryTerms.length
            : 0;

    if (abstractText.includes(query) || abstractCoverage >= 0.5) {
        return "abstract";
    }

    return "body";
};

export const mergeResultsByTier = <T>(...sourceResults: T[][]) => {
    const merged: T[] = [];
    const maxLength = Math.max(0, ...sourceResults.map((group) => group.length));

    for (let index = 0; index < maxLength; index += 1) {
        for (const group of sourceResults) {
            if (group[index]) {
                merged.push(group[index]);
            }
        }
    }

    return merged;
};

//Pass in a search Value or keywords to this function to handle the search of the paper IDs that match that keyword/search value
export const searchNIHPaperIds = async (
    searchValue: string,
    page: number = 0,
) => {
    if (!isNihApiConfigured()) {
        return {
            totalCount: 0,
            ids: [],
            page,
            totalPages: 0,
        };
    }

    const trimmed = searchValue.trim();
    const { ids, count: totalCount } = await runNIHEsearch(
        trimmed,
        page * RETMAX,
        RETMAX,
    );
    const tieredIds = ids.map((id) => ({
        id,
        matchTier: "abstract" as const,
    }));

    return {
        totalCount,
        ids: tieredIds,
        page,
        totalPages: Math.ceil(totalCount / RETMAX),
    };
};

//Now we will pass the the idList into this function to extract the data that contains the papers
export const getNIHPaperResults = async (
    tieredIds: TieredPaperId[],
    searchValue?: string,
) => {
    if (!isNihApiConfigured() || tieredIds.length === 0) {
        return [];
    }

    const idList = tieredIds.map(({ id }) => id);
    const params = new URLSearchParams({
        db: "pmc",
        id: idList.join(","),
        retmode: "json",
    });
    addNcbiIdentification(params);

    await enforceOutboundLimit("ncbi", NIH_API_KEY ? 9 : 2, 1_000);
    const res = await fetch(`${NIH_API_URL}/esummary.fcgi?${params}`);
    if (!res.ok) {
        throw new Error(`NCBI summary request failed: ${res.status}`);
    }
    const data = await res.json();
    const summaries = data?.result || {};

    return tieredIds
        .map(({ id, matchTier }) => {
            const summary = summaries[id];
            if (!summary) {
                return null;
            }
            const title = summary?.title || null;
            const authors = Array.isArray(summary?.authors)
                ? summary.authors
                      .map((author: any) => author?.name)
                      .filter(Boolean)
                : [];
            const date = summary?.pubdate || summary?.epubdate || null;

            return {
                pmcid: id,
                title,
                authors,
                abstract: null,
                date,
                matchTier: searchValue
                    ? inferMatchTier(
                          searchValue,
                          title,
                          null,
                      )
                    : matchTier,
            };
        })
        .filter(Boolean);
};

const parseSpringerTotal = (data: any, recordCount: number): number => {
    const totalValue = Array.isArray(data?.result)
        ? data?.result?.[0]?.total
        : data?.result?.total;

    const parsed = Number.parseInt(totalValue || "0", 10);
    return Math.max(Number.isNaN(parsed) ? 0 : parsed, recordCount);
};

const fetchSpringerSearchPage = async (
    query: string,
    page: number,
    pageSize: number,
) => {
    const params = new URLSearchParams();
    params.append("api_key", SPRINGER_API_KEY!);
    params.append("q", query);
    params.append("p", pageSize.toString());
    params.append("s", (page * pageSize + 1).toString());

    await enforceOutboundLimit("springer", 80, 60_000);
    const res = await fetch(`${SPRINGER_API_URL}?${params.toString()}`, {
        next: { revalidate: SPRINGER_CACHE_SECONDS },
    });
    if (!res.ok) {
        // Springer uses HTTP 404 for "zero matches", not only missing resources.
        if (res.status === 404) {
            return null;
        }
        const message =
            res.status === 403
                ? "Springer API returned 403 (check SPRINGER_API_KEY or quota)"
                : `Springer API error: ${res.status}`;
        console.warn(message);
        return null;
    }

    return res.json();
};

export const searchSpringerNaturePapers = async (
    searchValue: string,
    page: number = 0,
) => {
    // Match NIH page size so pagination feels consistent.
    const PAGE_SIZE = 10;

    // Do not fail the whole endpoint if Springer key is missing.
    if (!SPRINGER_API_KEY) {
        return {
            results: [],
            totalCount: 0,
            totalPages: 0,
        };
    }

    try {
        const query = buildSpringerSearchQuery(searchValue);
        if (!query) {
            return {
                results: [],
                totalCount: 0,
                totalPages: 0,
            };
        }

        let data = await fetchSpringerSearchPage(query, page, PAGE_SIZE);
        let records = Array.isArray(data?.records) ? data.records : [];

        if (!data || records.length === 0) {
            const fallbackQuery = buildSpringerFallbackQuery(searchValue);
            if (fallbackQuery && fallbackQuery !== query) {
                data = await fetchSpringerSearchPage(
                    fallbackQuery,
                    page,
                    PAGE_SIZE,
                );
                records = Array.isArray(data?.records) ? data.records : [];
            }
        }

        if (!data || records.length === 0) {
            return {
                results: [],
                totalCount: 0,
                totalPages: 0,
            };
        }

        const totalCount = parseSpringerTotal(data, records.length);

        // Convert Springer records into the same card shape NIH uses.
        const results = records.map((record: any, index: number) => {
            const doi = record?.doi || "";
            const authors = Array.isArray(record?.creators)
                ? record.creators
                      .map((creator: any) => creator?.creator)
                      .filter(Boolean)
                : [];

            const externalUrl = doi
                ? `https://doi.org/${doi}`
                : record?.url?.[0]?.value || "";

            const title = record?.title || "Untitled";
            const abstract =
                abstractToText(record?.abstract) ||
                "No abstract available from Springer Nature.";
            const rawLicense =
                typeof record?.license === "string"
                    ? record.license
                    : record?.license?.value ||
                      record?.license?.url ||
                      null;
            const access = evaluateContentAccess({
                source: "springer",
                rawLicense,
                licenseUrl:
                    typeof record?.license?.url === "string"
                        ? record.license.url
                        : null,
                attribution: {
                    title,
                    authors,
                    sourceLabel: "Springer Nature",
                    canonicalUrl: externalUrl,
                    paperId: doi,
                    idName: "doi",
                    publicationDate: record?.publicationDate || undefined,
                    publicationName: record?.publicationName || undefined,
                    publisher: record?.publisher || "Springer Nature",
                    doi: doi || undefined,
                },
            });

            return {
                sourceId: doi || `springer-${page}-${index}`,
                doi: doi || "",
                title,
                authors,
                date: record?.publicationDate || "",
                abstract,
                matchTier: inferMatchTier(searchValue, title, abstract),
                source: "nature",
                sourceLabel: "Springer Nature",
                sourceUrl: externalUrl,
                contentLabel: "Abstract",
                access,
            };
        });

        return {
            results,
            totalCount,
            totalPages:
                totalCount > 0
                    ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
                    : 0,
        };
    } catch (err) {
        console.error("Springer search failed:", err);
        return {
            results: [],
            totalCount: 0,
            totalPages: 0,
        };
    }
};

const extractYearFromSummary = (summary?: string): string => {
    const match = summary?.match(/\b(19|20)\d{2}\b/g);
    if (!match?.length) return "";
    return match[match.length - 1];
};

const parseScholarPublicationDate = (record: any): string => {
    const summary = record?.publication_info?.summary || "";
    return extractYearFromSummary(summary);
};

const parseScholarAuthors = (record: any): string[] => {
    const authors = record?.publication_info?.authors;
    if (Array.isArray(authors) && authors.length > 0) {
        return authors
            .map((author: any) => author?.name)
            .filter(Boolean);
    }

    const summary = record?.publication_info?.summary || "";
    const beforeDash = summary.split(" - ")[0] || "";
    if (!beforeDash) return [];

    return beforeDash
        .split(",")
        .map((name: string) => name.trim())
        .filter(Boolean);
};

const getScholarClusterId = (record: any): string => {
    return (
        record?.inline_links?.versions?.cluster_id ||
        record?.result_id ||
        ""
    );
};

const mapScholarRecord = (
    record: any,
    searchValue: string,
    page: number,
    index: number,
) => {
    const clusterId = getScholarClusterId(record);
    const title = record?.title || "Untitled";
    const authors = parseScholarAuthors(record);
    const abstract =
        record?.snippet || "No search snippet available from Google Scholar.";
    const date = parseScholarPublicationDate(record);
    const externalUrl = record?.link || record?.resources?.[0]?.link || "";
    const stableId = clusterId || record?.result_id || "";
    const access = evaluateContentAccess({
        source: "scholar",
        rawLicense: null,
        attribution: {
            title,
            authors,
            sourceLabel: "Google Scholar via SerpApi",
            canonicalUrl: externalUrl,
            paperId: stableId,
            idName: "cluster_id",
            publicationDate: date || undefined,
        },
    });

    return {
        sourceId: stableId,
        clusterId: stableId,
        title,
        authors,
        date,
        abstract,
        matchTier: inferMatchTier(searchValue, title, abstract),
        source: "scholar",
        sourceLabel: "Google Scholar",
        sourceUrl: externalUrl,
        contentLabel: "Search snippet",
        access,
    };
};

const fetchScholarSearchPage = async (
    searchValue: string,
    page: number,
    pageSize: number,
) => {
    const params = new URLSearchParams();
    params.append("engine", "google_scholar");
    params.append("q", searchValue.trim());
    params.append("api_key", SERPAPI_KEY!);
    params.append("num", pageSize.toString());
    params.append("start", (page * pageSize).toString());
    params.append("as_sdt", "0");
    params.append("hl", "en");

    await enforceOutboundLimit("serpapi", 60, 60_000);
    const res = await fetch(`${SERPAPI_URL}?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`SerpAPI error: ${res.status}`);
    }

    return res.json();
};

export const searchGoogleScholarPapers = async (
    searchValue: string,
    page: number = 0,
) => {
    const PAGE_SIZE = 10;

    if (!SERPAPI_KEY) {
        return {
            results: [],
            totalCount: 0,
            totalPages: 0,
        };
    }

    try {
        const data = await fetchScholarSearchPage(
            searchValue,
            page,
            PAGE_SIZE,
        );
        const records = Array.isArray(data?.organic_results)
            ? data.organic_results
            : [];

        const totalCount = Number.parseInt(
            data?.search_information?.total_results || "0",
            10,
        );

        const results = records
            .map((record: any, index: number) =>
                mapScholarRecord(record, searchValue, page, index),
            )
            .filter((result: any) => Boolean(result.sourceId));

        return {
            results,
            totalCount: Number.isNaN(totalCount) ? records.length : totalCount,
            totalPages:
                totalCount > 0
                    ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
                    : records.length > 0
                      ? 1
                      : 0,
        };
    } catch (err) {
        console.error("Google Scholar search failed:", err);
        return {
            results: [],
            totalCount: 0,
            totalPages: 0,
        };
    }
};

export type SourceFilter = "all" | "nih" | "springer" | "scholar";

export const getCombinedSearchTotalCount = async (
    searchValue: string,
    sourceFilter: SourceFilter = "all",
): Promise<number> => {
    const includeNih = sourceFilter === "all" || sourceFilter === "nih";
    const includeSpringer =
        sourceFilter === "all" || sourceFilter === "springer";
    const includeScholar =
        sourceFilter === "all" || sourceFilter === "scholar";

    const [nihSearch, springerSearch, scholarSearch] = await Promise.all([
        includeNih
            ? searchNIHPaperIds(searchValue, 0)
            : Promise.resolve({ totalCount: 0 }),
        includeSpringer
            ? searchSpringerNaturePapers(searchValue, 0)
            : Promise.resolve({ totalCount: 0 }),
        includeScholar
            ? searchGoogleScholarPapers(searchValue, 0)
            : Promise.resolve({ totalCount: 0 }),
    ]);

    return (
        nihSearch.totalCount +
        springerSearch.totalCount +
        scholarSearch.totalCount
    );
};
