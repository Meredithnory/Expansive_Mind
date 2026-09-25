import type { ContentAccessPolicy } from "../../lib/content-access-policy";
import type { FormattedPaper } from "../general-interfaces";
import type { PaperLocator, SourceDatabase } from "../../lib/paper-sources";
import type { SourceCitation } from "../../lib/research-citation";
import type { DiscoverCandidate } from "../discover/select-candidates";
import type { PaperFallback } from "../paper/load-paper";
import type { MatchTier } from "../search/utils";

export type WorkIndexId = "openalex" | "europepmc";
export type ProducerId = SourceDatabase | WorkIndexId;
export type ProviderLane = "home" | "index" | "oa";

export interface ProviderHealth {
    id: ProducerId | "unpaywall";
    lane: ProviderLane;
    configured: boolean;
}

export interface SourcePage<T> {
    hits: T[];
    totalCount: number;
    totalPages: number;
    warnings: string[];
    callCount: number;
}

export interface WorkLead {
    citation: SourceCitation;
    abstract: string;
    pmcid?: string;
    licenseHint?: string | null;
    licenseUrl?: string | null;
    producer: WorkIndexId;
}

export interface OaEvidence {
    doi: string;
    bestUrl?: string;
    pdfUrl?: string;
    rawLicense?: string | null;
    licenseUrl?: string | null;
    version?: string;
    hostType?: string;
}

export interface ResearchSource {
    id: SourceDatabase;
    isConfigured(): boolean;
    search(input: {
        query: string;
        page: number;
        hydrate: boolean;
    }): Promise<SourcePage<DiscoverCandidate>>;
    fetchFullText(
        locator: PaperLocator,
        fallback?: PaperFallback,
    ): Promise<FormattedPaper | null>;
}

export interface WorkIndex {
    id: WorkIndexId;
    isConfigured(): boolean;
    search(input: { query: string; page: number }): Promise<WorkLead[]>;
    resolveWork(doi: string): Promise<WorkLead | null>;
}

export interface OpenAccessLocator {
    id: "unpaywall";
    isConfigured(): boolean;
    locate(doi: string): Promise<OaEvidence | null>;
}

export interface SearchRow {
    sourceId: string;
    doi?: string;
    clusterId?: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string;
    matchTier?: MatchTier;
    source?: "nih" | "nature" | "scholar";
    sourceLabel?: string;
    sourceUrl?: string;
    contentLabel?: "Abstract" | "Search snippet";
    access?: ContentAccessPolicy;
}

export interface ProducerCounts {
    producer: ProducerId;
    candidates: number;
    eligible: number;
}
