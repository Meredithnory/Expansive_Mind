import { evaluateContentAccess } from "../../../lib/content-access-policy";
import { abstractToText } from "../../../lib/abstract-text";
import { PAPER_SOURCES } from "../../../lib/paper-sources";
import { normalizeDoi } from "../../../lib/research-citation";
import type { DiscoverCandidate } from "../../discover/select-candidates";
import { searchGoogleScholarPapers } from "../../search/utils";
import { getScholarPaperDetails } from "../../paper/utils";
import type { PaperLocator } from "../../../lib/paper-sources";
import type { ResearchSource } from "../types";

function mapScholarResults(results: Array<Record<string, unknown>>): DiscoverCandidate[] {
    return results.map((result) => {
        const paperId = String(
            result.clusterId || result.sourceId || "",
        ).trim();
        const authors = Array.isArray(result.authors) ? result.authors : [];
        const title = String(result.title || "Untitled");
        const sourceUrl =
            typeof result.sourceUrl === "string" ? result.sourceUrl : "";
        const doi = normalizeDoi(
            typeof result.doi === "string" ? result.doi : null,
        );
        const access =
            result.access && typeof result.access === "object"
                ? (result.access as DiscoverCandidate["access"])
                : evaluateContentAccess({
                      source: "scholar",
                      rawLicense: null,
                      attribution: {
                          title,
                          authors: authors.filter(
                              (author): author is string =>
                                  typeof author === "string",
                          ),
                          sourceLabel: PAPER_SOURCES.scholar.label,
                          canonicalUrl: sourceUrl,
                          paperId,
                          idName: "cluster_id",
                          publicationDate:
                              typeof result.date === "string"
                                  ? result.date
                                  : undefined,
                          doi: doi || undefined,
                      },
                  });

        return {
            database: PAPER_SOURCES.scholar.database,
            paperId,
            idName: "cluster_id",
            title,
            authors: authors.filter(
                (author): author is string => typeof author === "string",
            ),
            date: typeof result.date === "string" ? result.date : "",
            abstract: abstractToText(result.abstract) || "",
            sourceLabel: PAPER_SOURCES.scholar.label,
            sourceUrl,
            doi: doi || undefined,
            access,
        };
    });
}

export const scholarSource: ResearchSource = {
    id: "scholar",
    isConfigured: () => Boolean(process.env.SERPAPI_KEY),
    async search({ query, page }) {
        if (!process.env.SERPAPI_KEY) {
            return {
                hits: [],
                totalCount: 0,
                totalPages: 0,
                warnings: [],
                callCount: 0,
            };
        }
        const search = await searchGoogleScholarPapers(query, page);
        return {
            hits: mapScholarResults(
                (search.results as Array<Record<string, unknown>>) || [],
            ),
            totalCount: search.totalCount,
            totalPages: search.totalPages,
            warnings: [],
            callCount: 1,
        };
    },
    fetchFullText(locator: PaperLocator, fallback) {
        return getScholarPaperDetails(
            locator.paperId,
            PAPER_SOURCES.scholar.label,
            locator.idName,
            fallback,
        );
    },
};
