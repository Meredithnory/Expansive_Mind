// Shared Discover contract. Client HTTP types: src/app/discover/discover-types.ts
import type { SourceDatabase } from "../../lib/paper-sources";

/** Cited paper card returned by Discover and stored on SavedDiscovery. */
export interface DiscoverPaperCard {
    index: number;
    database: SourceDatabase;
    paperId: string;
    idName: string;
    title: string;
    authors: string[];
    date: string;
    sourceLabel: string;
    sourceUrl: string;
    href: string;
    doi?: string;
}

export type EvidenceType =
    | "review"
    | "rct"
    | "observational"
    | "in-vitro"
    | "animal"
    | "computational"
    | "other";

export type ReportConfidence = "established" | "suggested" | "speculative";

export interface PaperExcerptForSynthesis {
    index: number;
    title: string;
    sourceLabel: string;
    authors: string[];
    publicationDate?: string;
    excerpt: string;
}

export interface PaperExtraction {
    index: number;
    title: string;
    sourceLabel: string;
    authors: string[];
    publicationDate?: string;
    keyFindings: string[];
    methods: string;
    limitations: string[];
    openQuestions: string[];
    evidenceType: EvidenceType;
    /** Short licensed snippet shown when a citation is opened. Not full text. */
    supportingExcerpt?: string;
}

export interface ReportGap {
    title: string;
    description: string;
    whyItMatters: string;
    citations: number[];
    confidence: ReportConfidence;
}

export interface ReportProblem {
    title: string;
    description: string;
    gapRefs: number[];
}

export interface VenturePotentialItem {
    title: string;
    thesis: string;
    feasibilitySignals: string;
    risks: string;
    citations: number[];
}

export interface ProjectSeed {
    title: string;
    oneLiner: string;
    gapRef: number;
}

export interface OpportunityReportSections {
    stateOfScience: string;
    gaps: ReportGap[];
    problems: ReportProblem[];
    venturePotential: VenturePotentialItem[];
    couldNotVerify: string[];
    projectSeeds: ProjectSeed[];
}

export interface OpportunityReport {
    sections: OpportunityReportSections;
}
