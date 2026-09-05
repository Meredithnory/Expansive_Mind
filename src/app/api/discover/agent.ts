import { rankSearchResults } from "../search/semantic-rank";
import { loadCachedPaperBySource } from "../paper/load-paper";
import {
    selectPaperContext,
    selectQuotableExcerpt,
} from "../../lib/paper-context";
import {
    evaluateQuoteEligibility,
    paperHasFullTextBody,
} from "../../lib/quote-eligibility";
import {
    PAPER_SOURCES,
    buildPaperPath,
    searchSourceTag,
} from "../../lib/paper-sources";
import {
    selectDiscoverCandidates,
    type DiscoverCandidate,
} from "./select-candidates";
import {
    enrichOpenAccess,
    hasConfiguredLiteratureSource,
    mergeLoadedCitation,
    retrieve,
    shouldDropForOaConflict,
} from "../research/registry";
import { attachClaimLedger } from "./claim-ledger";
import { synthesizeOpportunityReport } from "./synthesize";
import {
    extractPaperFindings,
    fallbackPaperExtraction,
} from "./analyze";
import { expandDiscoveryQueries } from "./expand-queries";
import type {
    DiscoverPaperCard,
    OpportunityReport,
    PaperExcerptForSynthesis,
    PaperExtraction,
} from "./report-types";
import type { UsageContext } from "../../lib/usage-meter";
import { suggestSearchQueryNihOnly } from "../search/spell-suggest";
import {
    applyDiscoverySpellingSuggestion,
    buildNihDiscoveryQuery,
} from "./discovery-query";
import {
    judgeResearchQuestion,
    NO_RESULTS_COPY,
    shouldSearchLiterature,
} from "./question-quality";

export type { DiscoverPaperCard } from "./report-types";

export interface DiscoverAgentResult {
    question: string;
    papers: DiscoverPaperCard[];
    brief: string;
    report?: OpportunityReport;
    extractions: PaperExtraction[];
    noResults?: boolean;
    message?: string;
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

async function rankMergedCandidates(
    question: string,
    candidates: DiscoverCandidate[],
    usageContext?: UsageContext,
): Promise<DiscoverCandidate[]> {
    if (candidates.length <= 1) return candidates;

    const ranked = await rankSearchResults(
        question,
        candidates.map((candidate) => ({
            sourceId: candidate.paperId,
            doi: candidate.doi,
            title: candidate.title,
            abstract: candidate.abstract,
            source: searchSourceTag(candidate.database),
            access: candidate.access,
        })),
        usageContext,
    );
    const byId = new Map(
        candidates.map((candidate) => [candidate.paperId, candidate]),
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
}> {
    const searchQueries = queries.length > 0 ? queries : [question];
    const found = await retrieve({
        question,
        queries: searchQueries,
        nihQueries: searchQueries.map(buildNihDiscoveryQuery),
        includeScholar: Boolean(process.env.SERPAPI_KEY),
    });
    const ranked = await rankMergedCandidates(
        question,
        found.hits,
        usageContext,
    );
    const selected = selectDiscoverCandidates({ ranked });
    const countFor = (producer: (typeof found.counts)[number]["producer"]) =>
        found.counts.find((entry) => entry.producer === producer) ?? {
            candidates: 0,
            eligible: 0,
        };
    const springer = countFor("springer");
    const nih = countFor("nih");
    const europepmc = countFor("europepmc");
    const openalex = countFor("openalex");
    const scholar = countFor("scholar");

    return {
        selected,
        springerCandidateCount: springer.candidates,
        springerEligibleCount: springer.eligible,
        nihCandidateCount:
            nih.candidates + europepmc.candidates + openalex.candidates,
        nihEligibleCount:
            nih.eligible + europepmc.eligible + openalex.eligible,
        scholarCandidateCount: scholar.candidates,
        scholarEligibleCount: scholar.eligible,
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

            const oaDoi =
                paper.access?.attribution?.doi || candidate.doi;
            const oa = oaDoi ? await enrichOpenAccess(oaDoi) : null;
            if (shouldDropForOaConflict(paper, oa)) {
                throw new Error("Conflicting license records");
            }

            const loaded = mergeLoadedCitation(candidate, paper);
            const excerpt = selectPaperContext(paper, question);
            const quote = evaluateQuoteEligibility({
                source: paper.source || loaded.locator.database,
                database: loaded.locator.database,
                contentLabel: paper.contentLabel,
                hasFullTextBody: paperHasFullTextBody(paper),
                rawLicense: paper.access.rawLicense || oa?.rawLicense,
                licenseUrl: paper.access.licenseUrl || oa?.licenseUrl,
            });
            const quoteExcerpt = quote.allowed
                ? selectQuotableExcerpt(paper, question)
                : "";
            const card: DiscoverPaperCard = {
                index: index + 1,
                database: loaded.locator.database,
                paperId: loaded.locator.paperId,
                idName: loaded.locator.idName,
                title: paper.title || candidate.title,
                authors: paper.authors?.length
                    ? paper.authors
                    : candidate.authors,
                date: paper.publicationDate || candidate.date,
                sourceLabel: paper.primarySource || candidate.sourceLabel,
                sourceUrl:
                    paper.access.canonicalUrl || candidate.sourceUrl,
                href: buildPaperPath(
                    loaded.locator.database,
                    loaded.locator.paperId,
                    loaded.locator.idName,
                ),
                ...(loaded.citation.doi
                    ? { doi: loaded.citation.doi }
                    : {}),
                ...(quote.allowed && quote.licenseUrl
                    ? { licenseUrl: quote.licenseUrl }
                    : {}),
            };

            const synthesisPaper: PaperExcerptForSynthesis = {
                index: index + 1,
                title: card.title,
                sourceLabel: card.sourceLabel,
                authors: card.authors,
                publicationDate: card.date || undefined,
                excerpt,
                ...(quoteExcerpt ? { quoteExcerpt } : {}),
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

function emptyDiscoveryResult(question: string): DiscoverAgentResult {
    return {
        question,
        papers: [],
        brief: "",
        extractions: [],
        noResults: true,
        message: NO_RESULTS_COPY,
        meta: {
            springerCandidateCount: 0,
            springerEligibleCount: 0,
            nihCandidateCount: 0,
            nihEligibleCount: 0,
            scholarCandidateCount: 0,
            scholarEligibleCount: 0,
            nihFillCount: 0,
            papersUsed: 0,
            usedNihFill: false,
            usedScholar: false,
            subQueriesUsed: [],
            extractionFailureCount: 0,
        },
    };
}

export async function runDiscoverAgent(
    question: string,
    usageContext?: UsageContext,
): Promise<DiscoverAgentResult> {
    if (!hasConfiguredLiteratureSource()) {
        throw new DiscoverAgentError(
            "No literature sources are configured. Add SPRINGER_API_KEY, NIH (API_KEY and NCBI_EMAIL), SERPAPI_KEY, OPENALEX_API_KEY or OPENALEX_MAILTO, or EUROPEPMC_EMAIL to enable discovery.",
            503,
        );
    }

    // Cheap yes/no first. Expanding or eSpell-ing junk turns it into a real
    // topic, then we go read papers the user never asked for.
    const quality = await judgeResearchQuestion(question, usageContext);
    if (!shouldSearchLiterature(quality)) {
        return emptyDiscoveryResult(question);
    }

    let queries = await expandDiscoveryQueries(question, usageContext);
    let candidateResult = await retrieveCandidates(
        question,
        queries,
        usageContext,
    );
    let correctedQuery: string | undefined;

    if (candidateResult.selected.length === 0) {
        const suggestion = await suggestSearchQueryNihOnly(question).catch(
            () => null,
        );
        if (suggestion && suggestion.toLowerCase() !== question.toLowerCase()) {
            correctedQuery = applyDiscoverySpellingSuggestion(
                question,
                suggestion,
            );
            queries = await expandDiscoveryQueries(
                correctedQuery,
                usageContext,
            );
            candidateResult = await retrieveCandidates(
                correctedQuery,
                queries,
                usageContext,
            );
        }
    }

    const {
        selected,
        springerCandidateCount,
        springerEligibleCount,
        nihCandidateCount,
        nihEligibleCount,
        scholarCandidateCount,
        scholarEligibleCount,
    } = candidateResult;

    if (selected.length === 0) {
        throw new DiscoverAgentError(
            "No AI-eligible open-access papers were found for this question. Try a broader biomedical topic.",
            404,
        );
    }

    const { cards, excerpts } = await readPaperExcerpts(question, selected);

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

    const synthesis = await synthesizeOpportunityReport(
        question,
        extractions,
        usageContext,
    );
    if (!synthesis?.brief) {
        throw new DiscoverAgentError(
            "The research agent did not return a synthesis.",
            502,
        );
    }

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
        brief: synthesis.brief,
        report: synthesis.report
            ? attachClaimLedger(synthesis.report, cards, extractions)
            : undefined,
        extractions,
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
        },
    };
}
