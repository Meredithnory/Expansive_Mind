import {
    searchNIHPaperIds,
    getNIHPaperResults,
    searchSpringerNaturePapers,
    searchGoogleScholarPapers,
} from "../search/utils";
import { rankSearchResults } from "../search/semantic-rank";
import { evaluateContentAccess } from "../../lib/content-access-policy";
import { abstractToText } from "../../lib/abstract-text";
import { loadCachedPaperBySource } from "../paper/load-paper";
import { groundDiscoveryEvidence } from "../../lib/claim-evidence";
import { selectPaperContext } from "../../lib/paper-context";
import {
    PAPER_SOURCES,
    buildPaperPath,
    type SourceDatabase,
} from "../../lib/paper-sources";
import {
    selectDiscoverCandidates,
    dedupeDiscoverCandidates,
    type DiscoverCandidate,
} from "./select-candidates";
import {
    renderOpportunityReport,
    synthesizeOpportunityReport,
} from "./synthesize";
import {
    extractPaperFindings,
    fallbackPaperExtraction,
} from "./analyze";
import { expandDiscoveryQueries } from "./expand-queries";
import type {
    OpportunityReport,
    PaperExcerptForSynthesis,
    PaperExtraction,
} from "./report-types";
import type { UsageContext } from "../../lib/usage-meter";
import { assessDiscoveryQuestion, UNCLEAR_QUESTION_ERROR } from "./assess-query";
import { buildNihDiscoveryQuery } from "./discovery-query";
import { searchEuropePmc, searchCrossref, type IndexSearchStatus } from "./additional-indexes";

export interface DiscoverPaperCard {
    index: number;
    database: SourceDatabase;
    paperId: string;
    idName: string;
    title: string;
    authors: string[];
    date: string;
    sourceLabel: string;
    sourceUrl: string;
    href: string;
    doi?: string;
    indexedBy?: string[];
}

export interface DiscoverAgentResult {
    question: string;
    papers: DiscoverPaperCard[];
    brief: string;
    report?: OpportunityReport;
    extractions: PaperExtraction[];
    meta: {
        springerCandidateCount: number;
        springerEligibleCount: number;
        nihCandidateCount: number;
        nihEligibleCount: number;
        scholarCandidateCount: number;
        scholarEligibleCount: number;
        nihFillCount: number;
        papersUsed: number;
        usedNihFill: boolean;
        usedScholar: boolean;
        correctedQuery?: string;
        subQueriesUsed: string[];
        extractionFailureCount: number;
        additionalIndexes?: IndexSearchStatus[];
    };
}

export class DiscoverAgentError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "DiscoverAgentError";
        this.status = status;
    }
}

function mapSpringerResults(results: any[]): DiscoverCandidate[] {
    return results.map((result) => {
        const doi = String(result.doi || result.sourceId || "").trim();
        const authors = Array.isArray(result.authors) ? result.authors : [];
        const title = result.title || "Untitled";
        const abstract = abstractToText(result.abstract) || "";
        const sourceUrl =
            result.sourceUrl || (doi ? `https://doi.org/${doi}` : "");
        const access =
            result.access ||
            evaluateContentAccess({
                source: "springer",
                rawLicense: null,
                attribution: {
                    title,
                    authors,
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
            authors,
            date: result.date || "",
            abstract,
            sourceLabel: PAPER_SOURCES.springer.label,
            sourceUrl,
            doi: doi || undefined,
            indexedBy: ["Springer Nature"],
            access,
        };
    });
}

function mapNihResults(results: any[]): DiscoverCandidate[] {
    return results.map((paper) => {
        const pmcid = String(paper.pmcid || paper.sourceId || "").trim();
        const sourceUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${pmcid}/`;
        const authors = Array.isArray(paper.authors) ? paper.authors : [];
        const title = paper.title || "Untitled";
        const access = evaluateContentAccess({
            source: "nih",
            rawLicense: null,
            attribution: {
                title,
                authors,
                sourceLabel: PAPER_SOURCES.nih.label,
                canonicalUrl: sourceUrl,
                paperId: pmcid,
                idName: "pmcid",
                publicationDate: paper.date || undefined,
            },
        });

        return {
            database: PAPER_SOURCES.nih.database,
            paperId: pmcid,
            idName: "pmcid",
            title,
            authors,
            date: paper.date || "",
            abstract: abstractToText(paper.abstract) || "",
            sourceLabel: PAPER_SOURCES.nih.label,
            sourceUrl,
            doi: typeof paper.doi === "string" ? paper.doi : undefined,
            indexedBy: ["NIH PMC"],
            access,
        };
    });
}

function mapScholarResults(results: any[]): DiscoverCandidate[] {
    return results.map((result) => {
        const paperId = String(
            result.clusterId || result.sourceId || "",
        ).trim();
        const authors = Array.isArray(result.authors) ? result.authors : [];
        const title = result.title || "Untitled";
        const sourceUrl = result.sourceUrl || "";
        const access =
            result.access ||
            evaluateContentAccess({
                source: "scholar",
                rawLicense: null,
                attribution: {
                    title,
                    authors,
                    sourceLabel: PAPER_SOURCES.scholar.label,
                    canonicalUrl: sourceUrl,
                    paperId,
                    idName: "cluster_id",
                    publicationDate: result.date || undefined,
                },
            });

        return {
            database: PAPER_SOURCES.scholar.database,
            paperId,
            idName: "cluster_id",
            title,
            authors,
            date: result.date || "",
            abstract: abstractToText(result.abstract) || "",
            sourceLabel: PAPER_SOURCES.scholar.label,
            sourceUrl,
            doi: result.doi ? String(result.doi).trim() : undefined,
            indexedBy: ["Google Scholar"],
            access,
        };
    });
}

function rankSource(
    database: SourceDatabase,
): "nih" | "nature" | "scholar" {
    if (database === PAPER_SOURCES.nih.database) return "nih";
    if (database === PAPER_SOURCES.scholar.database) return "scholar";
    return "nature";
}

async function searchSpringerForQueries(
    queries: string[],
): Promise<DiscoverCandidate[]> {
    const settled = await Promise.allSettled(
        queries.map((query) => searchSpringerNaturePapers(query, 0)),
    );
    const mapped: DiscoverCandidate[] = [];
    for (const result of settled) {
        if (result.status !== "fulfilled") continue;
        mapped.push(...mapSpringerResults(result.value.results || []));
    }
    return dedupeDiscoverCandidates(mapped);
}

async function searchNihForQueries(
    queries: string[],
): Promise<DiscoverCandidate[]> {
    const settled = await Promise.allSettled(
        queries.map(async (query) => {
            const nihQuery = buildNihDiscoveryQuery(query);
            const nihSearch = await searchNIHPaperIds(nihQuery, 0);
            const nihPapers =
                nihSearch.ids.length > 0
                    ? await getNIHPaperResults(nihSearch.ids, nihQuery)
                    : [];
            return mapNihResults(nihPapers);
        }),
    );
    const mapped: DiscoverCandidate[] = [];
    for (const result of settled) {
        if (result.status !== "fulfilled") continue;
        mapped.push(...result.value);
    }
    return dedupeDiscoverCandidates(mapped);
}

async function searchScholarForQuestion(
    question: string,
): Promise<DiscoverCandidate[]> {
    if (!process.env.SERPAPI_KEY) return [];
    try {
        const search = await searchGoogleScholarPapers(question, 0);
        return dedupeDiscoverCandidates(
            mapScholarResults(search.results || []),
        );
    } catch (error) {
        console.error("Discovery Scholar search failed", error);
        return [];
    }
}

async function rankMergedCandidates(
    question: string,
    candidates: DiscoverCandidate[],
    usageContext?: UsageContext,
): Promise<DiscoverCandidate[]> {
    if (candidates.length <= 1) return candidates;

    const ranked = await rankSearchResults(
        question,
        candidates.map((candidate) => ({
            sourceId: `${candidate.database}:${candidate.paperId}`,
            doi: candidate.doi,
            title: candidate.title,
            abstract: candidate.abstract,
            source: rankSource(candidate.database),
            access: candidate.access,
        })),
        usageContext,
    );
    const byId = new Map(
        candidates.map((candidate) => [`${candidate.database}:${candidate.paperId}`, candidate]),
    );
    return ranked
        .map((result) => byId.get(result.sourceId))
        .filter((candidate): candidate is DiscoverCandidate =>
            Boolean(candidate),
        );
}

async function retrieveCandidates(
    question: string,
    queries: string[],
    usageContext?: UsageContext,
): Promise<{
    selected: DiscoverCandidate[];
    springerCandidateCount: number;
    springerEligibleCount: number;
    nihCandidateCount: number;
    nihEligibleCount: number;
    scholarCandidateCount: number;
    scholarEligibleCount: number;
    additionalIndexes: IndexSearchStatus[];
}> {
    const searchQueries = queries.length > 0 ? queries : [question];
    const [springerMapped, nihMapped, scholarMapped, europe, crossref] = await Promise.all([
        searchSpringerForQueries(searchQueries),
        searchNihForQueries(searchQueries),
        searchScholarForQuestion(question),
        searchEuropePmc(searchQueries.length > 1 ? searchQueries.slice(1, 3) : searchQueries),
        searchCrossref(question),
    ]);

    const merged = dedupeDiscoverCandidates([
        ...springerMapped,
        ...nihMapped,
        ...scholarMapped,
        ...europe.candidates,
        ...crossref.candidates,
    ]);
    const ranked = await rankMergedCandidates(
        question,
        merged,
        usageContext,
    );
    const selected = selectDiscoverCandidates({ ranked });

    return {
        selected,
        additionalIndexes: [europe.coverage, crossref.coverage],
        springerCandidateCount: springerMapped.length,
        springerEligibleCount: springerMapped.filter(
            (candidate) => candidate.access.canSendToAI,
        ).length,
        nihCandidateCount: nihMapped.length,
        nihEligibleCount: nihMapped.filter(
            (candidate) => candidate.access.canSendToAI,
        ).length,
        scholarCandidateCount: scholarMapped.length,
        scholarEligibleCount: scholarMapped.filter(
            (candidate) => candidate.access.canSendToAI,
        ).length,
    };
}

async function readPaperExcerpts(
    question: string,
    candidates: DiscoverCandidate[],
): Promise<{
    cards: DiscoverPaperCard[];
    excerpts: PaperExcerptForSynthesis[];
}> {
    const settled = await Promise.allSettled(
        candidates.map(async (candidate, index) => {
            const { value: paper } = await loadCachedPaperBySource(
                candidate.database,
                candidate.paperId,
                candidate.idName,
                {
                    title: candidate.title,
                    authors: candidate.authors,
                    abstract: candidate.abstract,
                },
            );
            if (!paper) {
                throw new Error("Paper not found");
            }
            if (!paper.access.canSendToAI) {
                throw new Error("Paper not approved for AI processing");
            }
            if (paper.status?.isRetracted) throw new Error("Retracted paper excluded from synthesis");

            const excerpt = selectPaperContext(paper, question);
            const card: DiscoverPaperCard = {
                index: index + 1,
                database: candidate.database,
                paperId: paper.paperId || candidate.paperId,
                idName: paper.idName || candidate.idName,
                title: paper.title || candidate.title,
                authors: paper.authors?.length
                    ? paper.authors
                    : candidate.authors,
                date: paper.publicationDate || candidate.date,
                sourceLabel: paper.primarySource || candidate.sourceLabel,
                sourceUrl:
                    paper.access.canonicalUrl || candidate.sourceUrl,
                href: buildPaperPath(
                    candidate.database,
                    paper.paperId || candidate.paperId,
                    paper.idName || candidate.idName,
                ),
                doi: candidate.doi,
                indexedBy: candidate.indexedBy,
            };

            const synthesisPaper: PaperExcerptForSynthesis = {
                index: index + 1,
                title: card.title,
                sourceLabel: card.sourceLabel,
                authors: card.authors,
                publicationDate: card.date || undefined,
                excerpt,
            };

            return { card, synthesisPaper };
        }),
    );

    const cards: DiscoverPaperCard[] = [];
    const excerpts: PaperExcerptForSynthesis[] = [];

    for (const result of settled) {
        if (result.status !== "fulfilled") continue;
        const nextIndex = cards.length + 1;
        cards.push({ ...result.value.card, index: nextIndex });
        excerpts.push({
            ...result.value.synthesisPaper,
            index: nextIndex,
        });
    }

    return { cards, excerpts };
}

function collectExtractions(
    excerpts: PaperExcerptForSynthesis[],
    settled: PromiseSettledResult<{
        extraction: PaperExtraction;
        usedFallback: boolean;
    }>[],
): { extractions: PaperExtraction[]; extractionFailureCount: number } {
    const extractions: PaperExtraction[] = [];
    let extractionFailureCount = 0;

    excerpts.forEach((paper, index) => {
        const result = settled[index];
        if (result?.status === "fulfilled") {
            if (result.value.usedFallback) extractionFailureCount += 1;
            extractions.push({
                ...result.value.extraction,
                index: paper.index,
            });
            return;
        }
        extractionFailureCount += 1;
        extractions.push(fallbackPaperExtraction(paper));
    });

    return { extractions, extractionFailureCount };
}

export async function runDiscoverAgent(
    question: string,
    usageContext?: UsageContext,
): Promise<DiscoverAgentResult> {
    const assessment = await assessDiscoveryQuestion(question).catch(() => ({
        status: "ok" as const,
        suggestion: null,
    }));
    if (assessment.status === "unclear") {
        throw new DiscoverAgentError(UNCLEAR_QUESTION_ERROR, 400);
    }
    const correctedQuery =
        assessment.status === "corrected" && assessment.suggestion
            ? assessment.suggestion
            : undefined;
    const searchQuestion = correctedQuery ?? question;

    const queries = await expandDiscoveryQueries(searchQuestion, usageContext);
    const candidateResult = await retrieveCandidates(
        searchQuestion,
        queries,
        usageContext,
    );

    const {
        selected,
        springerCandidateCount,
        springerEligibleCount,
        nihCandidateCount,
        nihEligibleCount,
        scholarCandidateCount,
        scholarEligibleCount,
        additionalIndexes,
    } = candidateResult;

    if (selected.length === 0) {
        throw new DiscoverAgentError(
            "No AI-eligible open-access papers were found for this question. Try a broader biomedical topic.",
            404,
        );
    }

    const { cards, excerpts } = await readPaperExcerpts(
        searchQuestion,
        selected,
    );

    if (excerpts.length === 0) {
        throw new DiscoverAgentError(
            "Papers were found, but none could be read for synthesis under the current access policy.",
            404,
        );
    }

    const extractionSettled = await Promise.allSettled(
        excerpts.map((paper) => extractPaperFindings(paper, usageContext)),
    );
    const { extractions, extractionFailureCount } = collectExtractions(
        excerpts,
        extractionSettled,
    );

    const prepared = groundDiscoveryEvidence({
        question: searchQuestion,
        excerpts,
        extractions,
        papers: cards,
    });
    const synthesis = await synthesizeOpportunityReport(
        searchQuestion,
        prepared.extractions,
        usageContext,
    );
    if (!synthesis?.brief) {
        throw new DiscoverAgentError(
            "The research agent did not return a synthesis.",
            502,
        );
    }
    const grounded = groundDiscoveryEvidence({
        question: searchQuestion,
        excerpts,
        extractions: prepared.extractions,
        papers: cards,
        gaps: synthesis.report?.sections.gaps,
    });
    const report = synthesis.report
        ? {
              ...synthesis.report,
              sections: {
                  ...synthesis.report.sections,
                  gaps: grounded.gaps,
              },
          }
        : undefined;
    const brief = report
        ? renderOpportunityReport(report)
        : synthesis.brief;

    const nihFillCount = cards.filter(
        (paper) => paper.database === PAPER_SOURCES.nih.database,
    ).length;
    const scholarCount = cards.filter(
        (paper) => paper.database === PAPER_SOURCES.scholar.database,
    ).length;
    const subQueriesUsed = queries.slice(1);

    return {
        question,
        papers: cards,
        brief,
        report,
        extractions: grounded.extractions,
        meta: {
            springerCandidateCount,
            springerEligibleCount,
            nihCandidateCount,
            nihEligibleCount,
            scholarCandidateCount,
            scholarEligibleCount,
            nihFillCount,
            papersUsed: cards.length,
            usedNihFill: nihFillCount > 0,
            usedScholar: scholarCount > 0,
            correctedQuery,
            subQueriesUsed,
            extractionFailureCount,
            additionalIndexes,
        },
    };
}
