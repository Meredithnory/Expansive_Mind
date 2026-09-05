import type {
    DiscoverPaperCard,
    OpportunityReport,
    PaperExtraction,
} from "../api/discover/report-types";

/** Client-facing Discover HTTP/API types. Read this instead of DiscoverClient.tsx. */
export type { DiscoverPaperCard, OpportunityReport, PaperExtraction };

export type DiscoveryQuota = {
    limit: number | null;
    used: number;
    remaining: number | null;
    unlimited?: boolean;
};

export type DiscoverResponse = {
    id: string;
    createdAt: string;
    question: string;
    papers: DiscoverPaperCard[];
    brief: string;
    report?: OpportunityReport;
    extractions?: PaperExtraction[];
    noResults?: boolean;
    message?: string;
    plan?: "guest" | "free" | "pro";
    quota?: DiscoveryQuota;
    meta: {
        springerCandidateCount: number;
        springerEligibleCount: number;
        nihFillCount: number;
        papersUsed: number;
        usedNihFill: boolean;
        usedScholar?: boolean;
        nihCandidateCount?: number;
        nihEligibleCount?: number;
        scholarCandidateCount?: number;
        scholarEligibleCount?: number;
        correctedQuery?: string;
        subQueriesUsed?: string[];
        extractionFailureCount?: number;
    };
};

export type DiscoverAgentStep =
    | "idle"
    | "checking"
    | "expanding"
    | "searching"
    | "reading"
    | "extracting"
    | "analyzing"
    | "composing"
    | "done";
