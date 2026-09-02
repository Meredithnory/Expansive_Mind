import "server-only";
import { cached } from "../../lib/provider-cache";
import type { SourceDatabase } from "../../lib/paper-sources";
import { fetchPaperBySource } from "./sources";

export const PAPER_DETAIL_CACHE_NAMESPACE = "paper-detail-v3";
export const PAPER_DETAIL_CACHE_TTL_SECONDS = 6 * 60 * 60;

export type PaperFallback = {
    title?: string;
    authors?: string[];
    abstract?: string;
};

export function paperDetailCacheKey(
    database: SourceDatabase,
    paperId: string,
    idName?: string,
) {
    return `${database}:${paperId}:${idName || ""}`;
}

export function loadCachedPaperBySource(
    database: SourceDatabase,
    paperId: string,
    idName?: string,
    fallback?: PaperFallback,
) {
    return cached({
        namespace: PAPER_DETAIL_CACHE_NAMESPACE,
        key: paperDetailCacheKey(database, paperId, idName),
        ttlSeconds: PAPER_DETAIL_CACHE_TTL_SECONDS,
        load: () =>
            fetchPaperBySource(database, paperId, idName, fallback),
    });
}
