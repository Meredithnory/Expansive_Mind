import type { ContentAccessPolicy } from "../../lib/content-access-policy";
import type { SourceDatabase } from "../../lib/paper-sources";
import { mergePaperImpact, type PaperImpact } from "../../lib/paper-impact";

export const TARGET_PAPER_COUNT = 10;
/** @deprecated Discovery now searches NIH on every run, not as a Springer fill. */
export const MIN_SPRINGER_BEFORE_NIH_FILL = 3;

export interface DiscoverCandidate extends PaperImpact {
    database: SourceDatabase;
    paperId: string;
    idName: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string;
    sourceLabel: string;
    sourceUrl: string;
    doi?: string;
    scholarCitesId?: string;
    indexedBy?: string[];
    access: ContentAccessPolicy;
}

export function filterAiEligible(
    candidates: DiscoverCandidate[],
): DiscoverCandidate[] {
    return candidates.filter((candidate) => candidate.access?.canSendToAI);
}

export function candidateKey(candidate: DiscoverCandidate): string {
    const doi = candidate.doi?.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
    if (doi) return `doi:${doi}`;
    return `${candidate.database}:${candidate.paperId.trim().toLowerCase()}`;
}

export function dedupeDiscoverCandidates(
    candidates: DiscoverCandidate[],
): DiscoverCandidate[] {
    const groups: { candidate: DiscoverCandidate; keys: Set<string> }[] = [];
    for (const candidate of candidates) {
        const id = candidate.database === "nih" ? candidate.paperId.trim().toLowerCase().replace(/^pmc/, "") : candidate.paperId.trim().toLowerCase();
        const keys = new Set([candidateKey(candidate), `${candidate.database}:${id}`]);
        const matches = groups.filter(group => [...keys].some(key => group.keys.has(key)));
        if (!matches.length) { groups.push({ candidate: { ...candidate }, keys }); continue; }
        // A DOI-bearing record can bridge two earlier records that shared no identifiers.
        const group = [...matches.map(entry => entry.candidate), candidate];
        const preferred = group.find(entry => entry.access.canSendToAI) || group[0];
        const indexedBy = [...new Set(group.flatMap(entry => entry.indexedBy || []))];
        const doi = preferred.doi || group.find(entry => entry.doi)?.doi;
        const impact = mergePaperImpact(...group);
        const combined = {
            ...preferred,
            ...(doi ? { doi } : {}),
            ...(indexedBy.length ? { indexedBy } : {}),
            ...impact,
        };
        const position = groups.indexOf(matches[0]);
        for (const entry of matches) { entry.keys.forEach(key => keys.add(key)); groups.splice(groups.indexOf(entry), 1); }
        groups.splice(position, 0, { candidate: combined, keys });
    }
    return groups.map(group => group.candidate);
}

/**
 * Take the top AI-eligible papers from a ranked pool spanning Springer,
 * NIH, and Google Scholar. Callers should pass already-ranked candidates;
 * source arrays are concatenated in order when `ranked` is omitted.
 */
export function selectDiscoverCandidates(options: {
    ranked?: DiscoverCandidate[];
    springer?: DiscoverCandidate[];
    nih?: DiscoverCandidate[];
    scholar?: DiscoverCandidate[];
    targetCount?: number;
}): DiscoverCandidate[] {
    const targetCount = options.targetCount ?? TARGET_PAPER_COUNT;
    const ranked =
        options.ranked ??
        [
            ...(options.springer ?? []),
            ...(options.nih ?? []),
            ...(options.scholar ?? []),
        ];

    return filterAiEligible(dedupeDiscoverCandidates(ranked)).slice(
        0,
        targetCount,
    );
}
