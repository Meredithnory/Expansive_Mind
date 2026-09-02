import type { ContentAccessPolicy } from "../../lib/content-access-policy";
import type { SourceDatabase } from "../../lib/paper-sources";

export const TARGET_PAPER_COUNT = 10;
/** @deprecated Discovery now searches NIH on every run, not as a Springer fill. */
export const MIN_SPRINGER_BEFORE_NIH_FILL = 3;

export interface DiscoverCandidate {
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
    access: ContentAccessPolicy;
}

export function filterAiEligible(
    candidates: DiscoverCandidate[],
): DiscoverCandidate[] {
    return candidates.filter((candidate) => candidate.access?.canSendToAI);
}

export function candidateKey(candidate: DiscoverCandidate): string {
    const doi = candidate.doi?.trim().toLowerCase();
    if (doi) return `doi:${doi}`;
    return `${candidate.database}:${candidate.paperId.trim().toLowerCase()}`;
}

export function dedupeDiscoverCandidates(
    candidates: DiscoverCandidate[],
): DiscoverCandidate[] {
    const seen = new Set<string>();
    const unique: DiscoverCandidate[] = [];
    for (const candidate of candidates) {
        const key = candidateKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(candidate);
    }
    return unique;
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
