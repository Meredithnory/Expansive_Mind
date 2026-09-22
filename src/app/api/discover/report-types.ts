export type EvidenceType =
    | "review"
    | "rct"
    | "observational"
    | "in-vitro"
    | "animal"
    | "computational"
    | "other";

export type ReportConfidence = "established" | "suggested" | "speculative";

export type ClaimKind = "finding" | "synthesis" | "hypothesis";

export type SourceAccess = "full_text" | "excerpt" | "abstract" | "metadata";

export type SupportRelation =
    | "supports"
    | "partial"
    | "contradicts"
    | "indirect"
    | "unverified";

export type PopulationMatch = "direct" | "indirect" | "unknown";

export type VerificationStatus =
    | "not_checked"
    | "machine_checked"
    | "reviewer_checked";

/** Design of the paper itself. Included-study design is stored separately. */
export type PaperStudyDesign =
    | "evidence-synthesis"
    | "rct"
    | "observational"
    | "preclinical-experimental"
    | "animal"
    | "computational"
    | "other";

export interface ClaimEvidenceRecord {
    claimId: string;
    claimText: string;
    claimKind: ClaimKind;
    /** DOI, PMID, or other stable paper id. An id alone is not support. */
    paperId: string;
    sourceAccess: SourceAccess;
    passageLocator?: string;
    /** Present only when this span exists in the licensed excerpt. */
    passageText?: string;
    supportRelation: SupportRelation;
    populationMatch: PopulationMatch;
    verificationStatus: VerificationStatus;
}

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
    /**
     * Licensed span that passed claim-level checks.
     * Never the generic opening of the excerpt.
     */
    supportingExcerpt?: string;
    population?: string;
    disease?: string;
    outcome?: string;
    timeHorizon?: string;
    studyDesign?: PaperStudyDesign;
    /** Design of studies included in a review. Empty for primary studies. */
    includedStudyDesign?: string;
    populationMatch?: PopulationMatch;
    claims?: ClaimEvidenceRecord[];
}

export interface ReportGap {
    title: string;
    description: string;
    whyItMatters: string;
    citations: number[];
    confidence: ReportConfidence;
    /** Why this gap is not a field-wide absence. */
    scopeNote?: string;
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
    founder?: import("../../lib/founder-report").FounderReport;
}
