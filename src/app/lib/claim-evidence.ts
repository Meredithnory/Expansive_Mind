import type {
    ClaimEvidenceRecord,
    ClaimKind,
    EvidenceType,
    PaperExtraction,
    PaperStudyDesign,
    PopulationMatch,
    ReportGap,
    SourceAccess,
    SupportRelation,
    VerificationStatus,
} from "../api/discover/report-types";

const MIN_QUOTE_CHARS = 20;

const STOP_WORDS = new Set([
    "about",
    "after",
    "again",
    "against",
    "among",
    "because",
    "been",
    "being",
    "between",
    "cancer",
    "cells",
    "clinical",
    "could",
    "evidence",
    "found",
    "from",
    "have",
    "into",
    "other",
    "paper",
    "patients",
    "patient",
    "research",
    "results",
    "should",
    "showed",
    "studies",
    "study",
    "that",
    "their",
    "there",
    "these",
    "this",
    "those",
    "therapy",
    "through",
    "treatment",
    "using",
    "were",
    "which",
    "while",
    "with",
    "within",
    "without",
    "would",
]);

const POPULATION_AXES: Array<{ id: string; pattern: RegExp }> = [
    {
        id: "pediatric",
        pattern: /\b(pediatric|paediatric|children|child|infant|adolescents?)\b/i,
    },
    { id: "adult", pattern: /\b(adults?|middle-aged|elderly)\b/i },
    { id: "solid-tumor", pattern: /\bsolid[\s-]?tumou?rs?\b/i },
    {
        id: "hematologic",
        pattern:
            /\b(hematolog\w*|haematolog\w*|b-cell|leukemi\w*|leukaemi\w*|lymphoma|immune thrombocytopenia|myeloma)\b/i,
    },
];

const AXIS_CONFLICTS: Array<[string, string]> = [
    ["pediatric", "adult"],
    ["solid-tumor", "hematologic"],
];

const ABSENCE_LANGUAGE =
    /\b(lack|lacks|lacking|incomplete|incompletely|unknown|untested|no evidence|not been|remains|remain|absence|absent|missing|unaddressed|not established)\b/i;

export function normalizeEvidenceText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

export function locatePassage(
    source: string,
    quote: string,
): { start: number; end: number } | null {
    const normalizedQuote = normalizeEvidenceText(quote);
    if (normalizedQuote.length < MIN_QUOTE_CHARS) return null;
    const normalizedSource = normalizeEvidenceText(source);
    const start = normalizedSource.indexOf(normalizedQuote);
    if (start < 0) return null;
    return { start, end: start + normalizedQuote.length };
}

function sectionTitleAt(source: string, quote: string): string {
    const normalizedQuote = normalizeEvidenceText(quote);
    let current = "Excerpt";
    let consumed = "";
    for (const line of source.split("\n")) {
        const heading = line.match(/^##\s+(.+)/);
        if (heading) current = heading[1].trim() || current;
        consumed = normalizeEvidenceText(`${consumed} ${line}`);
        if (consumed.includes(normalizedQuote)) return current;
    }
    return current;
}

export function passageLocator(source: string, quote: string): string | null {
    const located = locatePassage(source, quote);
    if (!located) return null;
    const section = sectionTitleAt(source, quote);
    return `${section} · characters ${located.start}–${located.end}`;
}

export function sourceAccessForExcerpt(excerpt: string): SourceAccess {
    const text = excerpt.trim();
    if (!text) return "metadata";
    if (/^##\s+abstract\b/i.test(text) && !/\n##\s+(?!abstract\b)/i.test(text)) {
        return "abstract";
    }
    return "excerpt";
}

function distinctiveTerms(text: string): string[] {
    return normalizeEvidenceText(text)
        .toLowerCase()
        .split(/[^a-z0-9+-]+/)
        .filter((term) => term.length > 4 && !STOP_WORDS.has(term));
}

export function termOverlap(claim: string, passage: string): number {
    const claimTerms = distinctiveTerms(claim);
    if (claimTerms.length === 0) return 0;
    const passageTerms = new Set(distinctiveTerms(passage));
    const hits = claimTerms.filter((term) => passageTerms.has(term)).length;
    return hits / claimTerms.length;
}

function axisHits(text: string): Set<string> {
    const found = new Set<string>();
    for (const axis of POPULATION_AXES) {
        if (axis.pattern.test(text)) found.add(axis.id);
    }
    return found;
}

/** Direct, indirect, or unknown. A conflicting population is never direct. */
export function classifyPopulationMatch(
    claimScope: string,
    paperText: string,
): PopulationMatch {
    const claim = axisHits(claimScope);
    const paper = axisHits(paperText);
    if (claim.size === 0 || paper.size === 0) return "unknown";
    for (const [left, right] of AXIS_CONFLICTS) {
        if (
            (claim.has(left) && paper.has(right)) ||
            (claim.has(right) && paper.has(left))
        ) {
            return "indirect";
        }
    }
    const claimKeys = [...claim];
    if (claimKeys.every((key) => paper.has(key))) return "direct";
    return "unknown";
}

function textMarksSynthesis(title: string, methods: string): boolean {
    if (
        /\b(systematic reviews?|meta-analyses|meta-analysis|meta analysis|scoping reviews?)\b/i.test(
            title,
        )
    ) {
        return true;
    }
    return /\b(we conducted|we performed|this systematic review|this meta-analysis|systematic review and meta-analysis)\b/i.test(
        methods,
    );
}

function textMarksRct(title: string, methods: string): boolean {
    return /\b(randomi[sz]ed(?:\s+controlled)?\s+trial|\brct\b|double-blind)\b/i.test(
        `${title}\n${methods}`,
    );
}

function textMarksLab(title: string, methods: string): boolean {
    return /\b(in[\s-]?vitro|laboratory comparison|cell-production|cell production|cell culture|cultured cells)\b/i.test(
        `${title}\n${methods}`,
    );
}

function textMarksHumanStudy(methods: string): boolean {
    return /\b(randomi[sz]ed|cohort of|patients with|participants|clinical trial)\b/i.test(
        methods,
    );
}

function textMarksAnimal(title: string, methods: string): boolean {
    return /\b(mouse|mice|murine|xenograft|rat model|animal model)\b/i.test(
        `${title}\n${methods}`,
    );
}

function includedDesign(text: string): string {
    if (/\brandomi[sz]ed\b/i.test(text)) return "randomized trials";
    if (/\b(observational|cohort|retrospective|case series)\b/i.test(text)) {
        return "observational";
    }
    if (/\b(in[\s-]?vitro|preclinical|animal)\b/i.test(text)) return "preclinical";
    return "";
}

const DESIGN_TO_EVIDENCE: Record<PaperStudyDesign, EvidenceType> = {
    "evidence-synthesis": "review",
    rct: "rct",
    observational: "observational",
    "preclinical-experimental": "in-vitro",
    animal: "animal",
    computational: "computational",
    other: "other",
};

const EVIDENCE_TO_DESIGN: Record<EvidenceType, PaperStudyDesign> = {
    review: "evidence-synthesis",
    rct: "rct",
    observational: "observational",
    "in-vitro": "preclinical-experimental",
    animal: "animal",
    computational: "computational",
    other: "other",
};

export function classifyStudyDesign(input: {
    title: string;
    methods: string;
    modelType: EvidenceType;
}): {
    evidenceType: EvidenceType;
    studyDesign: PaperStudyDesign;
    includedStudyDesign: string;
} {
    const { title, methods, modelType } = input;
    if (textMarksSynthesis(title, methods)) {
        return {
            evidenceType: "review",
            studyDesign: "evidence-synthesis",
            includedStudyDesign: includedDesign(`${title}\n${methods}`),
        };
    }
    if (textMarksRct(title, methods)) {
        return {
            evidenceType: "rct",
            studyDesign: "rct",
            includedStudyDesign: "",
        };
    }
    if (textMarksLab(title, methods) && !textMarksHumanStudy(methods)) {
        return {
            evidenceType: "in-vitro",
            studyDesign: "preclinical-experimental",
            includedStudyDesign: "",
        };
    }
    if (textMarksAnimal(title, methods) && !textMarksHumanStudy(methods)) {
        return {
            evidenceType: "animal",
            studyDesign: "animal",
            includedStudyDesign: "",
        };
    }
    const studyDesign = EVIDENCE_TO_DESIGN[modelType] ?? "other";
    return {
        evidenceType: DESIGN_TO_EVIDENCE[studyDesign],
        studyDesign,
        includedStudyDesign: "",
    };
}

export function studyDesignLabel(design: PaperStudyDesign | undefined): string {
    switch (design) {
        case "evidence-synthesis":
            return "Evidence synthesis";
        case "preclinical-experimental":
            return "Preclinical experiment";
        case "rct":
            return "RCT";
        case "observational":
            return "Observational";
        case "animal":
            return "Animal";
        case "computational":
            return "Computational";
        default:
            return "Other";
    }
}

const DESIGN_LABEL_ORDER = [
    "Evidence synthesis",
    "RCT",
    "Observational",
    "Preclinical experiment",
    "Animal",
    "Computational",
    "Other",
];

export function designMixLabel(
    extractions:
        | Array<{ evidenceType?: string; studyDesign?: PaperStudyDesign }>
        | undefined,
): string {
    if (!extractions || extractions.length === 0) return "";
    const counts = new Map<string, number>();
    for (const item of extractions) {
        const label = paperDesignLabel(item);
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return DESIGN_LABEL_ORDER.filter((label) => (counts.get(label) ?? 0) > 0)
        .map((label) => {
            const count = counts.get(label) ?? 0;
            return `${count} ${label.toLowerCase()}`;
        })
        .join(" · ");
}

export function paperDesignLabel(extraction: {
    evidenceType?: string;
    studyDesign?: PaperStudyDesign;
}): string {
    if (extraction.studyDesign) return studyDesignLabel(extraction.studyDesign);
    if (extraction.evidenceType === "review") return "Evidence synthesis";
    if (extraction.evidenceType === "in-vitro") return "Preclinical experiment";
    if (extraction.evidenceType === "rct") return "RCT";
    if (extraction.evidenceType === "observational") return "Observational";
    if (extraction.evidenceType === "animal") return "Animal";
    if (extraction.evidenceType === "computational") return "Computational";
    return "Other";
}

export function supportRelationLabel(relation: SupportRelation): string {
    switch (relation) {
        case "supports":
            return "Passage supports the claim";
        case "partial":
            return "Passage only partly matches";
        case "contradicts":
            return "Passage conflicts with the claim";
        case "indirect":
            return "Indirect population or setting";
        default:
            return "No passage establishes this claim";
    }
}

function paperScopeText(extraction: PaperExtraction): string {
    return [
        extraction.title,
        extraction.methods,
        extraction.population,
        extraction.disease,
    ]
        .filter(Boolean)
        .join("\n");
}

function strictestMatch(matches: PopulationMatch[]): PopulationMatch {
    if (matches.includes("indirect")) return "indirect";
    if (matches.every((match) => match === "direct") && matches.length > 0) {
        return "direct";
    }
    return "unknown";
}

function relationForLocatedClaim(input: {
    claimText: string;
    quote: string;
    start: number;
    populationMatch: PopulationMatch;
    modelRelation?: string;
}): SupportRelation {
    const overlap = termOverlap(input.claimText, input.quote);
    const opening = input.start < 240;
    if (overlap < 0.34 || (opening && overlap < 0.5)) return "unverified";
    if (input.populationMatch === "indirect") return "indirect";
    if (
        input.modelRelation === "contradicts" &&
        input.populationMatch !== "unknown"
    ) {
        return "contradicts";
    }
    if (input.populationMatch === "direct" && overlap >= 0.5 && !opening) {
        return "supports";
    }
    if (input.populationMatch === "direct" && overlap >= 0.6) return "supports";
    return "partial";
}

export function buildClaimRecord(input: {
    claimText: string;
    quote?: string;
    excerpt: string;
    paperId: string;
    ordinal: number;
    claimKind?: ClaimKind;
    question?: string;
    paperText?: string;
    modelRelation?: string;
}): ClaimEvidenceRecord {
    const claimText = normalizeEvidenceText(input.claimText).slice(0, 600);
    const paperId = input.paperId.trim() || `paper-${input.ordinal}`;
    const populationMatch = classifyPopulationMatch(
        `${input.question ?? ""}\n${claimText}`,
        input.paperText ?? "",
    );
    const quote = input.quote?.trim() ?? "";
    const located = locatePassage(input.excerpt, quote);
    const base = {
        claimId: `${paperId}#${input.ordinal}`,
        claimText,
        claimKind: input.claimKind ?? "finding",
        paperId,
        sourceAccess: sourceAccessForExcerpt(input.excerpt),
        populationMatch,
    };
    if (!located) {
        return {
            ...base,
            supportRelation: "unverified",
            verificationStatus: "not_checked",
        };
    }
    const supportRelation = relationForLocatedClaim({
        claimText,
        quote,
        start: located.start,
        populationMatch,
        modelRelation: input.modelRelation,
    });
    const verificationStatus: VerificationStatus = "machine_checked";
    return {
        ...base,
        passageLocator: passageLocator(input.excerpt, quote) ?? undefined,
        passageText: normalizeEvidenceText(quote).slice(0, 800),
        supportRelation,
        verificationStatus,
    };
}

function demoteSharedPassages(
    claims: ClaimEvidenceRecord[],
): ClaimEvidenceRecord[] {
    const groups = new Map<string, number[]>();
    claims.forEach((claim, index) => {
        if (!claim.passageText) return;
        const key = normalizeEvidenceText(claim.passageText);
        const indexes = groups.get(key) ?? [];
        indexes.push(index);
        groups.set(key, indexes);
    });
    const next = claims.slice();
    for (const indexes of groups.values()) {
        if (indexes.length < 2) continue;
        for (const index of indexes) {
            const claim = next[index];
            if (!claim.passageText) continue;
            if (termOverlap(claim.claimText, claim.passageText) < 0.5) {
                next[index] = {
                    ...claim,
                    supportRelation: "unverified",
                };
            }
        }
    }
    return next;
}

function groundedField(value: string, excerpt: string): string {
    const trimmed = normalizeEvidenceText(value).slice(0, 400);
    if (!trimmed) return "";
    if (locatePassage(excerpt, trimmed)) return trimmed;
    if (termOverlap(trimmed, excerpt) >= 0.34) return trimmed;
    return "";
}

export function groundPaperExtraction(input: {
    extraction: PaperExtraction;
    excerpt: string;
    paperId: string;
    question?: string;
    quotes?: string[];
    modelRelations?: string[];
}): PaperExtraction {
    const methods = input.extraction.methods.trim();
    const design = classifyStudyDesign({
        title: input.extraction.title,
        methods,
        modelType: input.extraction.evidenceType,
    });
    const population = groundedField(
        input.extraction.population ?? "",
        input.excerpt,
    );
    const disease = groundedField(input.extraction.disease ?? "", input.excerpt);
    const outcome = groundedField(input.extraction.outcome ?? "", input.excerpt);
    const timeHorizon = groundedField(
        input.extraction.timeHorizon ?? "",
        input.excerpt,
    );
    const paperText = [input.extraction.title, methods, population, disease]
        .filter(Boolean)
        .join("\n");
    const priorQuotes =
        input.quotes ??
        input.extraction.claims?.map((claim) => claim.passageText ?? "") ??
        [];
    const claims = demoteSharedPassages(
        input.extraction.keyFindings.map((finding, index) =>
            buildClaimRecord({
                claimText: finding,
                quote: priorQuotes[index] || "",
                excerpt: input.excerpt,
                paperId: input.paperId,
                ordinal: index + 1,
                question: input.question,
                paperText,
                modelRelation: input.modelRelations?.[index],
            }),
        ),
    );
    const supporting = claims.find(
        (claim) =>
            claim.passageText &&
            (claim.supportRelation === "supports" ||
                claim.supportRelation === "partial"),
    );
    const next: PaperExtraction = {
        ...input.extraction,
        methods,
        evidenceType: design.evidenceType,
        studyDesign: design.studyDesign,
        populationMatch: strictestMatch(
            claims.map((claim) => claim.populationMatch),
        ),
        claims,
    };
    if (design.includedStudyDesign) {
        next.includedStudyDesign = design.includedStudyDesign;
    } else {
        delete next.includedStudyDesign;
    }
    if (population) next.population = population;
    else delete next.population;
    if (disease) next.disease = disease;
    else delete next.disease;
    if (outcome) next.outcome = outcome;
    else delete next.outcome;
    if (timeHorizon) next.timeHorizon = timeHorizon;
    else delete next.timeHorizon;
    if (supporting?.passageText) next.supportingExcerpt = supporting.passageText;
    else delete next.supportingExcerpt;
    return next;
}

const SELECTED_PAPERS_NOTE =
    "This is a gap in the papers selected for this run, not a documented field-wide absence.";

function citedPapersAreIndirect(
    gap: ReportGap,
    extractions: PaperExtraction[],
): number[] {
    const scope = `${gap.title}\n${gap.description}`;
    return gap.citations.filter((index) => {
        const paper = extractions.find((item) => item.index === index);
        if (!paper) return false;
        return classifyPopulationMatch(scope, paperScopeText(paper)) === "indirect";
    });
}

function citedPapersLackSupport(
    gap: ReportGap,
    extractions: PaperExtraction[],
): boolean {
    if (gap.citations.length === 0) return true;
    return gap.citations.every((index) => {
        const paper = extractions.find((item) => item.index === index);
        if (!paper) return true;
        return !(paper.claims ?? []).some(
            (claim) =>
                claim.passageText && claim.supportRelation !== "unverified",
        );
    });
}

export function qualifyReportGaps(
    gaps: ReportGap[],
    extractions: PaperExtraction[],
): ReportGap[] {
    return gaps.map((gap) => {
        const text = `${gap.title} ${gap.description}`;
        const indirect = citedPapersAreIndirect(gap, extractions);
        const unsupported = citedPapersLackSupport(gap, extractions);
        const absence = ABSENCE_LANGUAGE.test(text);
        let confidence = gap.confidence;
        const notes = [SELECTED_PAPERS_NOTE];
        if (indirect.length > 0) {
            notes.push(
                `Paper ${indirect.join(", ")} ${indirect.length === 1 ? "describes" : "describe"} a different population or disease. That evidence is indirect context, not direct support.`,
            );
            if (confidence === "established") confidence = "suggested";
        }
        if (unsupported) {
            notes.push(
                "The cited papers do not include a verified passage for this gap.",
            );
            if (confidence === "established") confidence = "suggested";
        }
        if (absence && confidence === "established") confidence = "suggested";
        return {
            ...gap,
            confidence,
            scopeNote: notes.join(" "),
        };
    });
}

export function ledgerCounts(claims: ClaimEvidenceRecord[]): {
    total: number;
    located: number;
    directSupport: number;
} {
    return {
        total: claims.length,
        located: claims.filter((claim) => Boolean(claim.passageText)).length,
        directSupport: claims.filter(
            (claim) => claim.supportRelation === "supports",
        ).length,
    };
}

export function groundDiscoveryEvidence(input: {
    question: string;
    excerpts: Array<{ index: number; excerpt: string }>;
    extractions: PaperExtraction[];
    papers: Array<{ index: number; doi?: string; paperId?: string }>;
    gaps?: ReportGap[];
}): { extractions: PaperExtraction[]; gaps: ReportGap[] } {
    const excerptByIndex = new Map(
        input.excerpts.map((item) => [item.index, item.excerpt]),
    );
    const paperByIndex = new Map(
        input.papers.map((item) => [item.index, item]),
    );
    const extractions = input.extractions.map((extraction) => {
        const paper = paperByIndex.get(extraction.index);
        const doi = paper?.doi
            ?.trim()
            .replace(/^doi:\s*/i, "")
            .replace(/^https?:\/\/doi\.org\//i, "");
        const paperId = doi || paper?.paperId || `paper-${extraction.index}`;
        return groundPaperExtraction({
            extraction,
            excerpt: excerptByIndex.get(extraction.index) ?? "",
            paperId,
            question: input.question,
        });
    });
    return {
        extractions,
        gaps: qualifyReportGaps(input.gaps ?? [], extractions),
    };
}
