// Shared Discover contract. Client HTTP types: src/app/discover/discover-types.ts
import type { SourceDatabase } from "../../lib/paper-sources";
import type { PaperImpact } from "../../lib/paper-impact";
import type { QuoteGateReason } from "../../lib/quote-eligibility";

/** Cited paper card returned by Discover and stored on SavedDiscovery. */
export interface DiscoverPaperCard extends PaperImpact {
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
    /** SerpApi / Scholar cites id for the citing-works menu. */
    scholarCitesId?: string;
    indexedBy?: string[];
    /** Canonical commercial-friendly license URI when the paper is quote-eligible. */
    licenseUrl?: string;
    /** Why the passage was quoted or left out. Never authorizes a quote. */
    quoteGate?: QuoteGateReason;
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
    /** "abstract" when the paper's license keeps its body out of the model. */
    excerptKind?: "body" | "abstract";
    /** Body-only licensed excerpt for the claim ledger. Never a Scholar snippet or abstract. */
    quoteExcerpt?: string;
}

/**
 * Where a paper's text a sentence sits, without its words: a fingerprint of
 * the folded sentence and its folded length. The reader finds it again.
 */
export interface EvidenceAnchor {
    hash: string;
    length: number;
}

/**
 * A finding and the sentence of the paper that supports it, found word for
 * word in the excerpt the model read. Every item has an anchor; the sentence
 * text itself is kept only for quote-eligible papers.
 */
export interface PaperEvidence {
    /** "E3.2": paper 3, second item. Report prose cites it. */
    id: string;
    finding: string;
    quote?: string;
    anchor?: EvidenceAnchor;
}

/** One verified sentence of a paper: its text when quotable, always its anchor. */
export interface EvidenceSentence {
    quote?: string;
    anchor?: EvidenceAnchor;
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
    evidence?: PaperEvidence[];
    /** The paper's own sentence saying how the study was done ("Show method"). */
    methodsEvidence?: EvidenceSentence;
}

export interface ReportGap {
    title: string;
    description: string;
    whyItMatters: string;
    citations: number[];
    confidence: ReportConfidence;
    /** Why this gap is not a field-wide absence. */
    scopeNote?: string;
    /** Registry search terms: OR of AND-groups, e.g. [["senolytics","alzheimer"]]. */
    registryTerms?: string[][];
    /** Set only by attachGapActivity from live registry lookups, never by the model. */
    activity?: GapActivity;
}

/** NIH RePORTER project. No PI or institution: this renders on public briefs. */
export interface GapGrantRef {
    coreProjectNum: string;
    title: string;
    fiscalYear: number;
    href: string;
}

export interface GapTrialRef {
    nctId: string;
    title: string;
    status: string;
    phase?: string;
    href: string;
}

export interface GapRegistryResult<T> {
    status: "ok" | "unavailable";
    /** Matching records the registry reported. Grants count project-years. */
    total: number;
    items: T[];
}

/** Who else is working on a gap. No matches is not evidence of absence. */
export interface GapActivity {
    checkedAt: string;
    query: string;
    fiscalYears: number[];
    grants: GapRegistryResult<GapGrantRef>;
    trials: GapRegistryResult<GapTrialRef>;
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
    /**
     * Per text field ("stateOfScience", "gaps.0.description"), the evidence id
     * each "Paper N" chip cites, in chip order; null for a plain citation.
     */
    citationEvidence?: Record<string, Array<string | null>>;
}

export type ClaimLedgerKind = "gap" | "problem" | "venture";

/** One paper cited for a ledger claim. Quote is a licensed excerpt, never invented. */
export interface ClaimLedgerSource {
    paperIndex: number;
    paperId?: string;
    doi?: string;
    href?: string;
    /** Paper title shown with the quote. A quote without a title is omitted. */
    title?: string;
    quote: string;
    /** Canonical commercial-friendly license URI that justified the quote. */
    licenseUrl?: string;
    /** Set only when the paper studied a narrower group than the question (e.g. livestock). */
    scope?: string;
}

/** One claim on the opportunity brief, listed once, with every paper cited for it. */
export interface ClaimLedgerRow {
    id: string;
    kind: ClaimLedgerKind;
    claim: string;
    sources: ClaimLedgerSource[];
    confidence?: ReportConfidence;
}

export interface ClaimLedger {
    rows: ClaimLedgerRow[];
}

export interface OpportunityReport {
    sections: OpportunityReportSections;
    founder?: import("../../lib/founder-report").FounderReport;
    claimLedger?: ClaimLedger;
}
