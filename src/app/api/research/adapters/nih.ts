import { evaluateContentAccess } from "../../../lib/content-access-policy";
import { abstractToText } from "../../../lib/abstract-text";
import { PAPER_SOURCES } from "../../../lib/paper-sources";
import { normalizeDoi } from "../../../lib/research-citation";
import type { DiscoverCandidate } from "../../discover/select-candidates";
import {
    getNIHPaperResults,
    isNihApiConfigured,
    searchNIHPaperIds,
} from "../../search/utils";
import { getPaperDetails } from "../../paper/utils";
import type { PaperLocator } from "../../../lib/paper-sources";
import type { ResearchSource } from "../types";
import { fetchPmcFullTextViaEuropePmc, isEuropePmcConfigured } from "./europepmc";

function mapNihPapers(results: Array<Record<string, unknown>>): DiscoverCandidate[] {
    return results.map((paper) => {
        const pmcid = String(paper.pmcid || paper.sourceId || "").trim();
        const sourceUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${pmcid}/`;
        const authors = Array.isArray(paper.authors) ? paper.authors : [];
        const title = String(paper.title || "Untitled");
        const doi = normalizeDoi(
            typeof paper.doi === "string" ? paper.doi : null,
        );
        const access = evaluateContentAccess({
            source: "nih",
            rawLicense: null,
            attribution: {
                title,
                authors: authors.filter(
                    (author): author is string => typeof author === "string",
                ),
                sourceLabel: PAPER_SOURCES.nih.label,
                canonicalUrl: sourceUrl,
                paperId: pmcid,
                idName: "pmcid",
                publicationDate:
                    typeof paper.date === "string" ? paper.date : undefined,
                doi: doi || undefined,
            },
        });

        return {
            database: PAPER_SOURCES.nih.database,
            paperId: pmcid,
            idName: "pmcid",
            title,
            authors: authors.filter(
                (author): author is string => typeof author === "string",
            ),
            date: typeof paper.date === "string" ? paper.date : "",
            abstract: abstractToText(paper.abstract) || "",
            sourceLabel: PAPER_SOURCES.nih.label,
            sourceUrl,
            doi: doi || undefined,
            access,
        };
    });
}

export const nihSource: ResearchSource = {
    id: "nih",
    isConfigured: () => isNihApiConfigured() || isEuropePmcConfigured(),
    async search({ query, page, hydrate }) {
        if (!isNihApiConfigured()) {
            return {
                hits: [],
                totalCount: 0,
                totalPages: 0,
                warnings: [
                    "NIH PubMed Central search is unavailable until NCBI_EMAIL is configured.",
                ],
                callCount: 0,
            };
        }

        const nihSearch = await searchNIHPaperIds(query, page);
        const papers =
            hydrate && nihSearch.ids.length > 0
                ? await getNIHPaperResults(nihSearch.ids, query)
                : [];
        return {
            hits: mapNihPapers(
                (papers as Array<Record<string, unknown>>) || [],
            ),
            totalCount: nihSearch.totalCount,
            totalPages: nihSearch.totalPages,
            warnings: [],
            callCount: hydrate && nihSearch.ids.length > 0 ? 2 : 1,
        };
    },
    async fetchFullText(locator: PaperLocator) {
        const paper = await getPaperDetails(
            locator.paperId,
            PAPER_SOURCES.nih.label,
            locator.idName,
        );
        if (paper) return paper;
        if (!isEuropePmcConfigured()) return null;
        return fetchPmcFullTextViaEuropePmc(
            locator.paperId,
            PAPER_SOURCES.nih.label,
            locator.idName,
        );
    },
};

