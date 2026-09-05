import "server-only";
import {
    locatorFromLoadedPaper,
    makePaperLocator,
    searchSourceTag,
    type SourceDatabase,
} from "../../lib/paper-sources";
import {
    mergeCitations,
    normalizeCitation,
    normalizeDoi,
    workKey,
} from "../../lib/research-citation";
import type { DiscoverCandidate } from "../discover/select-candidates";
import { dedupeDiscoverCandidates } from "../discover/select-candidates";
import type { FormattedPaper } from "../general-interfaces";
import type { PaperFallback } from "../paper/load-paper";
import { nihSource } from "./adapters/nih";
import { springerSource } from "./adapters/springer";
import { scholarSource } from "./adapters/scholar";
import { openAlexIndex } from "./adapters/openalex";
import { europePmcIndex } from "./adapters/europepmc";
import { unpaywallLocator } from "./adapters/unpaywall";
import { homeLead } from "./homing";
import { oaConflictsWithHome } from "./oa";
import type {
    OaEvidence,
    ProducerCounts,
    ProviderHealth,
    ResearchSource,
    SearchRow,
    SourcePage,
    WorkIndex,
    WorkLead,
} from "./types";

const HOMES: Record<SourceDatabase, ResearchSource> = {
    nih: nihSource,
    springer: springerSource,
    scholar: scholarSource,
};

const INDEXES: WorkIndex[] = [openAlexIndex, europePmcIndex];

export function providerHealth(): ProviderHealth[] {
    return [
        {
            id: "nih",
            lane: "home",
            configured: nihSource.isConfigured(),
        },
        {
            id: "springer",
            lane: "home",
            configured: springerSource.isConfigured(),
        },
        {
            id: "scholar",
            lane: "home",
            configured: scholarSource.isConfigured(),
        },
        {
            id: "openalex",
            lane: "index",
            configured: openAlexIndex.isConfigured(),
        },
        {
            id: "europepmc",
            lane: "index",
            configured: europePmcIndex.isConfigured(),
        },
        {
            id: "unpaywall",
            lane: "oa",
            configured: unpaywallLocator.isConfigured(),
        },
    ];
}

export function hasConfiguredLiteratureSource(): boolean {
    return providerHealth().some(
        (provider) =>
            provider.configured &&
            (provider.lane === "home" || provider.lane === "index"),
    );
}

function emptyCounts(producer: ProducerCounts["producer"]): ProducerCounts {
    return { producer, candidates: 0, eligible: 0 };
}

function countsFromHits(
    producer: ProducerCounts["producer"],
    hits: DiscoverCandidate[],
): ProducerCounts {
    return {
        producer,
        candidates: hits.length,
        eligible: hits.filter((hit) => hit.access.canSendToAI).length,
    };
}

async function searchHome(
    database: SourceDatabase,
    query: string,
    page: number,
    hydrate: boolean,
): Promise<SourcePage<DiscoverCandidate>> {
    const home = HOMES[database];
    if (!home.isConfigured()) {
        return {
            hits: [],
            totalCount: 0,
            totalPages: 0,
            warnings: [],
            callCount: 0,
        };
    }
    try {
        return await home.search({ query, page, hydrate });
    } catch {
        return {
            hits: [],
            totalCount: 0,
            totalPages: 0,
            warnings: [],
            callCount: 0,
        };
    }
}

async function searchIndexes(query: string, page: number): Promise<{
    homed: DiscoverCandidate[];
    unreachable: number;
    counts: ProducerCounts[];
}> {
    const settled = await Promise.allSettled(
        INDEXES.filter((index) => index.isConfigured()).map(async (index) => {
            const leads = await index.search({ query, page });
            return { id: index.id, leads };
        }),
    );

    const homed: DiscoverCandidate[] = [];
    const counts: ProducerCounts[] = [];
    let unreachable = 0;

    for (const result of settled) {
        if (result.status !== "fulfilled") {
            continue;
        }
        const hits: DiscoverCandidate[] = [];
        for (const lead of result.value.leads) {
            const hit = homeLead(lead);
            if (hit) hits.push(hit);
            else unreachable += 1;
        }
        homed.push(...hits);
        counts.push(countsFromHits(result.value.id, hits));
    }

    return { homed, unreachable, counts };
}

export async function retrieve(input: {
    question: string;
    queries: string[];
    nihQueries?: string[];
    includeScholar: boolean;
}): Promise<{
    hits: DiscoverCandidate[];
    counts: ProducerCounts[];
    unreachable: number;
}> {
    const queries = input.queries.length > 0 ? input.queries : [input.question];
    const nihQueries =
        input.nihQueries && input.nihQueries.length > 0
            ? input.nihQueries
            : queries;
    const homeJobs: Promise<{
        producer: SourceDatabase;
        hits: DiscoverCandidate[];
    }>[] = [
        Promise.all(
            queries.map((query) => searchHome("springer", query, 0, true)),
        ).then((pages) => ({
            producer: "springer" as const,
            hits: pages.flatMap((page) => page.hits),
        })),
        Promise.all(
            nihQueries.map((query) => searchHome("nih", query, 0, true)),
        ).then((pages) => ({
            producer: "nih" as const,
            hits: pages.flatMap((page) => page.hits),
        })),
    ];

    if (input.includeScholar) {
        homeJobs.push(
            searchHome("scholar", input.question, 0, true).then((page) => ({
                producer: "scholar" as const,
                hits: page.hits,
            })),
        );
    }

    const indexJobs = Promise.all(
        queries.map((query) => searchIndexes(query, 0)),
    );

    const [homeSettled, indexPages] = await Promise.all([
        Promise.allSettled(homeJobs),
        indexJobs,
    ]);

    const counts: ProducerCounts[] = [
        emptyCounts("springer"),
        emptyCounts("nih"),
        emptyCounts("scholar"),
        emptyCounts("openalex"),
        emptyCounts("europepmc"),
    ];
    const hits: DiscoverCandidate[] = [];
    let unreachable = 0;

    for (const result of homeSettled) {
        if (result.status !== "fulfilled") continue;
        hits.push(...result.value.hits);
        const next = countsFromHits(result.value.producer, result.value.hits);
        const index = counts.findIndex(
            (entry) => entry.producer === result.value.producer,
        );
        if (index >= 0) counts[index] = next;
    }

    for (const page of indexPages) {
        hits.push(...page.homed);
        unreachable += page.unreachable;
        for (const count of page.counts) {
            const index = counts.findIndex(
                (entry) => entry.producer === count.producer,
            );
            if (index >= 0) {
                counts[index] = {
                    producer: count.producer,
                    candidates: counts[index].candidates + count.candidates,
                    eligible: counts[index].eligible + count.eligible,
                };
            }
        }
    }

    return {
        hits: dedupeDiscoverCandidates(hits),
        counts,
        unreachable,
    };
}

export function toSearchRow(hit: DiscoverCandidate): SearchRow {
    return {
        sourceId: hit.paperId,
        doi: hit.doi,
        title: hit.title,
        authors: hit.authors,
        date: hit.date,
        abstract: hit.abstract,
        source: searchSourceTag(hit.database),
        sourceLabel: hit.sourceLabel,
        sourceUrl: hit.sourceUrl,
        contentLabel:
            hit.database === "scholar" ? "Search snippet" : "Abstract",
        access: hit.access,
    };
}

export async function searchHomed(input: {
    query: string;
    page: number;
    databases: SourceDatabase[];
    hydrate: boolean;
}): Promise<{
    byDatabase: { database: SourceDatabase; hits: SearchRow[] }[];
    totalCount: number;
    totalPages: number;
    warnings: string[];
    callCount: number;
}> {
    const settled = await Promise.all(
        input.databases.map(async (database) => {
            const page = await searchHome(
                database,
                input.query,
                input.page,
                input.hydrate,
            );
            return { database, page };
        }),
    );

    let totalCount = 0;
    let totalPages = 0;
    let callCount = 0;
    const warnings: string[] = [];
    const byDatabase = settled.map(({ database, page }) => {
        totalCount += page.totalCount;
        totalPages = Math.max(totalPages, page.totalPages);
        callCount += page.callCount;
        warnings.push(...page.warnings);
        return {
            database,
            hits: page.hits.map(toSearchRow),
        };
    });

    return { byDatabase, totalCount, totalPages, warnings, callCount };
}

export async function loadDocument(input: {
    locator: ReturnType<typeof makePaperLocator>;
    fallback?: PaperFallback;
}): Promise<FormattedPaper | null> {
    const home = HOMES[input.locator.database];
    return home.fetchFullText(input.locator, input.fallback);
}

export async function resolveDoi(doi: string): Promise<WorkLead | null> {
    const normalized = normalizeDoi(doi);
    if (!normalized) return null;
    for (const index of INDEXES) {
        if (!index.isConfigured()) continue;
        const lead = await index.resolveWork(normalized).catch(() => null);
        if (lead) return lead;
    }
    return null;
}

export async function enrichOpenAccess(doi: string): Promise<OaEvidence | null> {
    if (!unpaywallLocator.isConfigured()) return null;
    return unpaywallLocator.locate(doi);
}

export function citationFromPaper(
    paper: FormattedPaper,
    requested: ReturnType<typeof makePaperLocator>,
) {
    const locator = locatorFromLoadedPaper(paper, requested);
    const citation = normalizeCitation({
        title: paper.title,
        authors: paper.authors,
        doi: paper.access?.attribution?.doi,
        date: paper.publicationDate,
        url: paper.access?.canonicalUrl,
    });
    return {
        locator,
        citation,
        key: workKey({ doi: citation.doi, locator }),
    };
}

export function mergeLoadedCitation(
    search: DiscoverCandidate,
    paper: FormattedPaper,
) {
    const requested = makePaperLocator(
        search.database,
        search.paperId,
        search.idName,
    );
    const loaded = citationFromPaper(paper, requested);
    return {
        ...loaded,
        citation: mergeCitations(
            normalizeCitation({
                title: search.title,
                authors: search.authors,
                doi: search.doi,
                date: search.date,
                url: search.sourceUrl,
            }),
            loaded.citation,
        ),
    };
}

export function shouldDropForOaConflict(
    paper: FormattedPaper,
    evidence: OaEvidence | null,
): boolean {
    if (!evidence) return false;
    return oaConflictsWithHome(evidence, paper.access);
}
