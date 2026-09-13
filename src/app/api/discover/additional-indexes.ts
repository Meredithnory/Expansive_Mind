import { abstractToText } from "../../lib/abstract-text";
import { evaluateContentAccess } from "../../lib/content-access-policy";
import { dedupeDiscoverCandidates, type DiscoverCandidate } from "./select-candidates";

export type IndexSearchStatus = {
    name: string;
    status: "ok" | "partial" | "unavailable";
    metadataCount: number;
    candidateCount: number;
    eligibleCount: number;
    note: string;
};
type IndexResult = { candidates: DiscoverCandidate[]; coverage: IndexSearchStatus };
const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const CROSSREF = "https://api.crossref.org/works";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function normalizeDiscoveryDoi(value: unknown): string | undefined {
    const doi = text(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
    return /^10\.\d{4,9}\/[^\s"\\<>]+$/.test(doi) && doi.length <= 250 ? doi : undefined;
}

async function fetchJson(url: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Research index unavailable");
    return response.json() as Promise<unknown>;
}

async function europeRecords(query: string): Promise<unknown[]> {
    const params = new URLSearchParams({ query: `(${query}) AND IN_PMC:Y`, format: "json", resultType: "core", pageSize: "16" });
    const data = record(await fetchJson(`${EUROPE_PMC}?${params}`));
    const resultList = record(data.resultList);
    if (data.errMsg || !Array.isArray(resultList.result)) throw new Error("Invalid Europe PMC response");
    return resultList.result.slice(0, 16);
}

/** Search indexes locate papers; PMC remains the content host and checks full-text rights again. */
export function mapEuropePmcRecord(raw: unknown, indexedBy: string[] = ["Europe PMC"]): DiscoverCandidate | null {
    const item = record(raw);
    const pmcid = text(item.pmcid).match(/^PMC([1-9]\d*)$/i)?.[1];
    const pubTypes = list(record(item.pubTypeList).pubType).map(text);
    if (!pmcid || !["MED", "PMC"].includes(text(item.source)) || pubTypes.some(type => /preprint|retracted publication|retraction of publication/i.test(type)) || item.isRetracted === "Y") return null;
    const title = abstractToText(text(item.title)).trim();
    if (!title) return null;
    const authors = list(record(item.authorList).author).map(author => text(record(author).fullName)).filter(Boolean);
    const doi = normalizeDiscoveryDoi(item.doi);
    const sourceUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${pmcid}/`;
    const date = text(item.firstPublicationDate) || text(item.pubYear);
    return {
        database: "nih", paperId: pmcid, idName: "pmcid", title, authors, date,
        abstract: abstractToText(text(item.abstractText)), sourceLabel: "NIH PubMed Central", sourceUrl, doi, indexedBy,
        access: evaluateContentAccess({ source: "nih", rawLicense: text(item.license) || null,
            attribution: { title, authors, sourceLabel: "Europe PMC", canonicalUrl: sourceUrl, paperId: pmcid, idName: "pmcid", doi, publicationDate: date } }),
    };
}

function finish(name: string, candidates: DiscoverCandidate[], metadataCount: number, status: IndexSearchStatus["status"], note: string): IndexResult {
    const unique = dedupeDiscoverCandidates(candidates);
    return { candidates: unique, coverage: { name, status, metadataCount, candidateCount: unique.length, eligibleCount: unique.filter(candidate => candidate.access.canSendToAI).length, note } };
}

export async function searchEuropePmc(queries: string[]): Promise<IndexResult> {
    const boundedQueries = [...new Set(queries.map(query => query.trim()).filter(Boolean))].slice(0, 2);
    const settled = await Promise.allSettled(boundedQueries.map(europeRecords));
    const records = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const failures = settled.filter(result => result.status === "rejected").length;
    return finish("Europe PMC", records.map(item => mapEuropePmcRecord(item)).filter((item): item is DiscoverCandidate => Boolean(item)), records.length,
        failures === settled.length && failures > 0 ? "unavailable" : failures ? "partial" : "ok",
        failures ? "Some Europe PMC searches failed; coverage is incomplete." : "Search index results with PMC full text; preprints and known retractions are excluded. Full-text access is checked before synthesis.");
}

export async function searchCrossref(question: string): Promise<IndexResult> {
    let metadataCount = 0;
    try {
        const params = new URLSearchParams({ "query.bibliographic": question.slice(0, 500), rows: "12", filter: "type:journal-article", select: "DOI" });
        if (process.env.CROSSREF_MAILTO) params.set("mailto", process.env.CROSSREF_MAILTO);
        const data = record(await fetchJson(`${CROSSREF}?${params}`));
        const items = record(data.message).items;
        if (!Array.isArray(items)) throw new Error("Invalid Crossref response");
        metadataCount = items.length;
        const dois = [...new Set(items.map(item => normalizeDiscoveryDoi(record(item).DOI)).filter((doi): doi is string => Boolean(doi)))].slice(0, 12);
        if (!dois.length) return finish("Crossref", [], metadataCount, "ok", "No usable journal-article DOIs found.");
        const resolved = await europeRecords(dois.map(doi => `DOI:"${doi}"`).join(" OR "));
        const candidates = resolved.filter(item => {
            const doi = normalizeDiscoveryDoi(record(item).doi);
            return doi && dois.includes(doi);
        }).map(item => mapEuropePmcRecord(item, ["Crossref", "Europe PMC"])).filter((item): item is DiscoverCandidate => Boolean(item));
        return finish("Crossref", candidates, metadataCount, "ok", "Metadata discovery only. DOI matches are resolved through Europe PMC; only readable PMC papers can enter synthesis. Metadata-only records are not evidence.");
    } catch {
        return finish("Crossref", [], metadataCount, metadataCount ? "partial" : "unavailable", "Crossref search or DOI resolution failed; coverage is incomplete.");
    }
}
