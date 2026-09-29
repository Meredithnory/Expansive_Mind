import "server-only";
import { cached } from "../../lib/provider-cache";
import { getContentAccessMode } from "../../lib/content-access-policy";
import type { SourceDatabase } from "../../lib/paper-sources";
import { fetchPaperBySource } from "./sources";

export const PAPER_DETAIL_CACHE_NAMESPACE = "paper-detail-v5";

// Strict and legacy results differ (strict never holds an unlicensed body),
// so each mode reads only its own entries.
export function paperDetailCacheNamespace() {
    return `${PAPER_DETAIL_CACHE_NAMESPACE}-${getContentAccessMode()}`;
}
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
        namespace: paperDetailCacheNamespace(),
        key: paperDetailCacheKey(database, paperId, idName),
        ttlSeconds: PAPER_DETAIL_CACHE_TTL_SECONDS,
        load: () =>
            fetchPaperBySource(database, paperId, idName, fallback),
    });
}
