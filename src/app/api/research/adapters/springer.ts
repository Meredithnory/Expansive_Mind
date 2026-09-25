import { evaluateContentAccess } from "../../../lib/content-access-policy";
import { abstractToText } from "../../../lib/abstract-text";
import { PAPER_SOURCES } from "../../../lib/paper-sources";
import { normalizeDoi } from "../../../lib/research-citation";
import type { DiscoverCandidate } from "../../discover/select-candidates";
import { searchSpringerNaturePapers } from "../../search/utils";
import { getSpringerPaperDetails } from "../../paper/utils";
import type { PaperLocator } from "../../../lib/paper-sources";
import type { ResearchSource } from "../types";

function mapSpringerResults(results: Array<Record<string, unknown>>): DiscoverCandidate[] {
    return results.map((result) => {
        const doi =
            normalizeDoi(
                String(result.doi || result.sourceId || ""),
            ) || String(result.doi || result.sourceId || "").trim();
        const authors = Array.isArray(result.authors) ? result.authors : [];
        const title = String(result.title || "Untitled");
        const abstract = abstractToText(result.abstract) || "";
        const sourceUrl =
            (typeof result.sourceUrl === "string" && result.sourceUrl) ||
            (doi ? `https://doi.org/${doi}` : "");
        const access =
            result.access && typeof result.access === "object"
                ? (result.access as DiscoverCandidate["access"])
                : evaluateContentAccess({
                      source: "springer",
                      rawLicense: null,
                      attribution: {
                          title,
                          authors: authors.filter(
                              (author): author is string =>
                                  typeof author === "string",
                          ),
                          sourceLabel: PAPER_SOURCES.springer.label,
                          canonicalUrl: sourceUrl,
                          paperId: doi,
                          idName: "doi",
                          doi: doi || undefined,
                      },
                  });

        return {
            database: PAPER_SOURCES.springer.database,
            paperId: doi,
            idName: "doi",
            title,
            authors: authors.filter(
                (author): author is string => typeof author === "string",
            ),
            date: typeof result.date === "string" ? result.date : "",
            abstract,
            sourceLabel: PAPER_SOURCES.springer.label,
            sourceUrl,
            doi: doi || undefined,
            access,
        };
    });
}

export const springerSource: ResearchSource = {
    id: "springer",
    isConfigured: () => Boolean(process.env.SPRINGER_API_KEY),
    async search({ query, page }) {
        if (!process.env.SPRINGER_API_KEY) {
            return {
                hits: [],
                totalCount: 0,
                totalPages: 0,
                warnings: [],
                callCount: 0,
            };
        }
        const search = await searchSpringerNaturePapers(query, page);
        return {
            hits: mapSpringerResults(
                (search.results as Array<Record<string, unknown>>) || [],
            ),
            totalCount: search.totalCount,
            totalPages: search.totalPages,
            warnings: [],
            callCount: 1,
        };
    },
    fetchFullText(locator: PaperLocator, fallback) {
        return getSpringerPaperDetails(
            locator.paperId,
            PAPER_SOURCES.springer.label,
            locator.idName,
            fallback,
        );
    },
};
