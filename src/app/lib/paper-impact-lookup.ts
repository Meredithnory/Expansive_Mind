import "server-only";
import { getCachedValue, setCachedValue } from "./provider-cache";
import {
    mergePaperImpact,
    normalizePaperDoi,
    normalizePmcid,
    parseCitationCount,
    type CitationSource,
    type PaperImpact,
} from "./paper-impact";

const CROSSREF = "https://api.crossref.org/works";
const EUROPE_PMC =
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const IMPACT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const BATCH_SIZE = 12;

export type ImpactLookupInput = PaperImpact & {
    doi?: string | null;
    pmcid?: string | null;
    paperId?: string | null;
    idName?: string | null;
};

export function impactLookupKey(
    input: ImpactLookupInput,
): string | undefined {
    const doi = normalizePaperDoi(input.doi);
    if (doi) return `doi:${doi}`;
    const pmcid = normalizePmcid(
        input.pmcid || (input.idName === "pmcid" ? input.paperId : undefined),
    );
    return pmcid ? `pmcid:${pmcid}` : undefined;
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
}

function chunk<T>(items: T[], size: number): T[][] {
    const groups: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        groups.push(items.slice(index, index + size));
    }
    return groups;
}

function crossrefHeaders() {
    const mailto = process.env.CROSSREF_MAILTO?.trim();
    return {
        Accept: "application/json",
        ...(mailto
            ? { "User-Agent": `ExpansiveMind/1.0 (mailto:${mailto})` }
            : {}),
    };
}

async function fetchJson(url: string, headers?: HeadersInit) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json", ...headers },
    });
    if (!response.ok) throw new Error("Citation index unavailable");
    return response.json() as Promise<unknown>;
}

async function lookupCrossref(dois: string[]): Promise<Map<string, PaperImpact>> {
    const found = new Map<string, PaperImpact>();
    if (dois.length === 0) return found;

    await Promise.all(
        chunk(dois, BATCH_SIZE).map(async (batch) => {
            try {
                const params = new URLSearchParams({
                    filter: batch.map((doi) => `doi:${doi}`).join(","),
                    rows: String(batch.length),
                    select: "DOI,is-referenced-by-count",
                });
                if (process.env.CROSSREF_MAILTO) {
                    params.set("mailto", process.env.CROSSREF_MAILTO);
                }
                const data = record(await fetchJson(`${CROSSREF}?${params}`, crossrefHeaders()));
                const items = record(data.message).items;
                if (!Array.isArray(items)) return;
                for (const item of items) {
                    const row = record(item);
                    const doi = normalizePaperDoi(row.DOI);
                    const citationCount = parseCitationCount(
                        row["is-referenced-by-count"],
                    );
                    if (doi && citationCount != null) {
                        found.set(doi, {
                            citationCount,
                            citationSource: "crossref",
                        });
                    }
                }
            } catch (error) {
                console.warn("Crossref citation lookup failed", error);
            }
        }),
    );

    return found;
}

async function lookupEuropePmc(input: {
    dois?: string[];
    pmcids?: string[];
}): Promise<Map<string, PaperImpact>> {
    const found = new Map<string, PaperImpact>();
    const clauses = [
        ...(input.dois ?? []).map((doi) => `DOI:"${doi}"`),
        ...(input.pmcids ?? []).map((pmcid) => `PMCID:PMC${pmcid}`),
    ];
    if (clauses.length === 0) return found;

    await Promise.all(
        chunk(clauses, BATCH_SIZE).map(async (batch) => {
            try {
                const params = new URLSearchParams({
                    query: batch.join(" OR "),
                    format: "json",
                    resultType: "lite",
                    pageSize: String(batch.length),
                });
                const data = record(await fetchJson(`${EUROPE_PMC}?${params}`));
                const results = record(data.resultList).result;
                if (!Array.isArray(results)) return;
                for (const item of results) {
                    const row = record(item);
                    const impact: PaperImpact = {
                        citationCount: parseCitationCount(row.citedByCount),
                        citationSource: "europepmc",
                    };
                    if (impact.citationCount == null) continue;
                    const doi = normalizePaperDoi(row.doi);
                    const pmcid = normalizePmcid(row.pmcid);
                    if (doi) found.set(`doi:${doi}`, impact);
                    if (pmcid) found.set(`pmcid:${pmcid}`, impact);
                }
            } catch (error) {
                console.warn("Europe PMC citation lookup failed", error);
            }
        }),
    );

    return found;
}

async function readImpactCache(key: string) {
    try {
        return await getCachedValue<PaperImpact>("paper-impact", key);
    } catch (error) {
        console.warn("Paper impact cache read failed", error);
        return null;
    }
}

async function writeImpactCache(key: string, impact: PaperImpact) {
    try {
        await setCachedValue(
            "paper-impact",
            key,
            impact,
            IMPACT_CACHE_TTL_SECONDS,
        );
    } catch (error) {
        console.warn("Paper impact cache write failed", error);
    }
}

export async function lookupMissingPaperImpact(
    papers: ImpactLookupInput[],
): Promise<Map<string, PaperImpact>> {
    const resolved = new Map<string, PaperImpact>();
    const pending = new Map<string, ImpactLookupInput>();

    for (const paper of papers) {
        const key = impactLookupKey(paper);
        const existing = mergePaperImpact(paper);
        if (existing.citationCount != null) {
            if (key) resolved.set(key, existing);
            continue;
        }
        if (key && !pending.has(key) && !resolved.has(key)) {
            pending.set(key, paper);
        }
    }

    await Promise.all(
        [...pending.keys()].map(async (key) => {
            const cachedValue = await readImpactCache(key);
            if (cachedValue?.citationCount == null) return;
            resolved.set(key, cachedValue);
            pending.delete(key);
        }),
    );

    const dois: string[] = [];
    const pmcids: string[] = [];
    for (const paper of pending.values()) {
        const doi = normalizePaperDoi(paper.doi);
        const pmcid = normalizePmcid(
            paper.pmcid ||
                (paper.idName === "pmcid" ? paper.paperId : undefined),
        );
        if (doi) dois.push(doi);
        else if (pmcid) pmcids.push(pmcid);
    }

    const uniqueDois = [...new Set(dois)];
    const uniquePmcids = [...new Set(pmcids)];
    if (uniqueDois.length === 0 && uniquePmcids.length === 0) {
        return resolved;
    }

    const [crossref, europe] = await Promise.all([
        lookupCrossref(uniqueDois),
        lookupEuropePmc({
            dois: uniqueDois,
            pmcids: uniquePmcids,
        }),
    ]);

    await Promise.all(
        [...pending.entries()].map(async ([key, paper]) => {
            const doi = normalizePaperDoi(paper.doi);
            const pmcid = normalizePmcid(
                paper.pmcid ||
                    (paper.idName === "pmcid" ? paper.paperId : undefined),
            );
            const impact = mergePaperImpact(
                doi ? crossref.get(doi) : undefined,
                doi ? europe.get(`doi:${doi}`) : undefined,
                pmcid ? europe.get(`pmcid:${pmcid}`) : undefined,
            );
            if (impact.citationCount == null) return;
            resolved.set(key, impact);
            await writeImpactCache(key, impact);
        }),
    );

    return resolved;
}

export async function attachPaperImpact<T extends ImpactLookupInput>(
    papers: T[],
): Promise<Array<T & PaperImpact>> {
    try {
        const lookedUp = await lookupMissingPaperImpact(papers);
        return papers.map((paper) => {
            const key = impactLookupKey(paper);
            return {
                ...paper,
                ...mergePaperImpact(paper, key ? lookedUp.get(key) : undefined),
            };
        });
    } catch (error) {
        console.warn("Paper impact enrichment failed", error);
        return papers;
    }
}

export async function attachFormattedPaperImpact<T extends {
    paperId?: string;
    idName?: string;
    doi?: string;
    citationCount?: number;
    citationSource?: CitationSource;
    access?: { attribution?: { doi?: string } };
}>(paper: T): Promise<T & PaperImpact> {
    try {
        const [enriched] = await attachPaperImpact([
            {
                ...paper,
                doi: paper.doi || paper.access?.attribution?.doi,
                pmcid: paper.idName === "pmcid" ? paper.paperId : undefined,
            },
        ]);
        const { pmcid: _pmcid, ...rest } = enriched;
        return rest as T & PaperImpact;
    } catch (error) {
        console.warn("Paper impact enrichment failed", error);
        return paper;
    }
}
