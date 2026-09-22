import { describe, expect, it } from "vitest";
import type { PaperExtraction, ReportGap } from "../api/discover/report-types";
import {
    buildClaimRecord,
    classifyPopulationMatch,
    classifyStudyDesign,
    designMixLabel,
    groundDiscoveryEvidence,
    groundPaperExtraction,
    ledgerCounts,
    locatePassage,
    qualifyReportGaps,
} from "./claim-evidence";

const intro =
    "Oncolytic viruses activate innate immunity in the tumor microenvironment and can recruit immune cells.";

function extraction(
    overrides: Partial<PaperExtraction> & Pick<PaperExtraction, "title" | "methods">,
): PaperExtraction {
    return {
        index: 1,
        sourceLabel: "Springer Nature",
        authors: ["A. Author"],
        keyFindings: [],
        limitations: [],
        openQuestions: [],
        evidenceType: "observational",
        ...overrides,
    };
}

describe("locatePassage", () => {
    it("finds a normalized span and rejects a DOI with no quote", () => {
        const source = `## Introduction\n${intro}`;
        expect(locatePassage(source, intro)?.start).toBeGreaterThanOrEqual(0);
        expect(locatePassage(source, "10.1007/s44466-026-00055-z")).toBeNull();
        expect(locatePassage(source, "too short")).toBeNull();
    });
});

describe("claim passages", () => {
    it("does not treat a generic introduction as support for a different claim", () => {
        const claim = buildClaimRecord({
            claimText:
                "Antigen-escape mechanisms remain incomplete in solid tumors.",
            quote: intro,
            excerpt: `${intro} Later sections discuss delivery.`,
            paperId: "10.1007/s44466-026-00055-z",
            ordinal: 1,
            paperText: "solid tumors",
        });
        expect(claim.paperId).toBe("10.1007/s44466-026-00055-z");
        expect(claim.supportRelation).toBe("unverified");
        expect(claim.verificationStatus).toBe("machine_checked");
        expect(claim.verificationStatus).not.toBe("reviewer_checked");
    });

    it("leaves a missing excerpt unverified even when a DOI is present", () => {
        const claim = buildClaimRecord({
            claimText: "Antigen escape is incompletely mapped in solid tumors.",
            quote: "",
            excerpt: intro,
            paperId: "10.1007/s44466-026-00055-z",
            ordinal: 1,
        });
        expect(claim.supportRelation).toBe("unverified");
        expect(claim.passageText).toBeUndefined();
        expect(claim.verificationStatus).toBe("not_checked");
    });

    it("does not attach another paper's passage", () => {
        const grounded = groundDiscoveryEvidence({
            question: "Why does CAR-T fail in solid tumors?",
            excerpts: [
                { index: 1, excerpt: intro },
                {
                    index: 2,
                    excerpt:
                        "Antigen escape reduced detectable target cells in the solid-tumor cultures after infusion.",
                },
            ],
            papers: [
                { index: 1, doi: "10.1000/paper-1", paperId: "p1" },
                { index: 2, doi: "10.1000/paper-2", paperId: "p2" },
            ],
            extractions: [
                extraction({
                    index: 2,
                    title: "Antigen escape in solid tumors",
                    methods: "Cell culture assay in solid-tumor models.",
                    evidenceType: "in-vitro",
                    keyFindings: [
                        "Antigen escape reduced detectable target cells in solid-tumor cultures.",
                    ],
                    claims: [
                        {
                            claimId: "temp",
                            claimText:
                                "Antigen escape reduced detectable target cells in solid-tumor cultures.",
                            claimKind: "finding",
                            paperId: "10.1000/paper-1",
                            sourceAccess: "excerpt",
                            passageText: intro,
                            supportRelation: "supports",
                            populationMatch: "direct",
                            verificationStatus: "machine_checked",
                        },
                    ],
                }),
            ],
        });
        const claim = grounded.extractions[0].claims?.[0];
        expect(claim?.paperId).toBe("10.1000/paper-2");
        expect(claim?.supportRelation).toBe("unverified");
        expect(claim?.passageText).toBeUndefined();
    });

    it("accepts a passage that actually states the claim", () => {
        const quote =
            "Antigen escape reduced detectable target cells in the solid-tumor cultures after infusion.";
        const claim = buildClaimRecord({
            claimText:
                "Antigen escape reduced detectable target cells in solid-tumor cultures.",
            quote,
            excerpt: `## Results\n${quote}`,
            paperId: "10.1000/direct",
            ordinal: 1,
            question: "What happens to target cells in solid tumors?",
            paperText:
                "Adults with solid tumors were studied in a cell culture comparison.",
        });
        expect(claim.supportRelation).toBe("supports");
        expect(claim.passageLocator).toContain("Results");
        expect(claim.passageLocator!.length).toBeLessThanOrEqual(200);
    });

    it("keeps a locator short when the excerpt heading was flattened onto one line", () => {
        const quote =
            "Antigen escape reduced detectable target cells in the solid-tumor cultures after infusion.";
        const claim = buildClaimRecord({
            claimText:
                "Antigen escape reduced detectable target cells in solid-tumor cultures.",
            quote,
            excerpt: `## Abstract ${"Immunosenescence describes age-related immune decline. ".repeat(120)}${quote}`,
            paperId: "10.1000/flat",
            ordinal: 1,
            question: "What happens to target cells in solid tumors?",
            paperText: "Adults with solid tumors were studied.",
        });
        expect(claim.passageLocator).toMatch(/^Abstract /);
        expect(claim.passageLocator!.length).toBeLessThanOrEqual(200);
        expect(claim.verificationStatus).toBe("machine_checked");
        expect(claim.populationMatch).not.toBe("indirect");
    });

    it("demotes one introduction reused under unrelated claims", () => {
        const grounded = groundPaperExtraction({
            extraction: extraction({
                title: "Solid tumor review",
                methods: "Narrative summary.",
                evidenceType: "review",
                keyFindings: [
                    "Antigen escape reduced detectable target cells in solid-tumor cultures.",
                    "Manufacturing yield changed under a different cytokine schedule.",
                ],
            }),
            excerpt: intro,
            paperId: "10.1000/shared",
            quotes: [intro, intro],
        });
        expect(
            grounded.claims?.every(
                (claim) => claim.supportRelation === "unverified",
            ),
        ).toBe(true);
        expect(grounded.supportingExcerpt).toBeUndefined();
    });
});

describe("population scope", () => {
    it("keeps hematologic and adult evidence indirect for pediatric solid tumors", () => {
        expect(
            classifyPopulationMatch(
                "Safety of CAR-T in children with solid tumors is not established.",
                "Retrospective cohort of people with B-cell malignancies.",
            ),
        ).toBe("indirect");
        expect(
            classifyPopulationMatch(
                "Pediatric solid-tumor safety remains unknown.",
                "Case of a middle-aged woman with immune thrombocytopenia.",
            ),
        ).toBe("indirect");

        const quote =
            "Pediatric solid-tumor safety was established in this B-cell malignancy cohort during observation.";
        const grounded = groundPaperExtraction({
            question: "Which pediatric solid-tumor safety gaps remain?",
            extraction: extraction({
                index: 7,
                title: "Hematologic toxicity after CAR-T",
                methods: "Retrospective cohort of people with B-cell malignancies.",
                population: "people with B-cell malignancies",
                keyFindings: [
                    "Pediatric solid-tumor safety was established in this cohort.",
                ],
            }),
            excerpt: quote,
            paperId: "10.1000/heme",
            quotes: [quote],
        });
        expect(grounded.populationMatch).toBe("indirect");
        expect(grounded.claims?.[0].supportRelation).toBe("indirect");
        expect(grounded.claims?.[0].supportRelation).not.toBe("supports");
    });
});

describe("study design", () => {
    it("recognizes an evidence synthesis and keeps included-study design separate", () => {
        const design = classifyStudyDesign({
            title: "CAR-T failure in solid tumors: a systematic review and meta-analysis",
            methods:
                "We conducted a systematic review and meta-analysis of observational cohorts.",
            modelType: "observational",
        });
        expect(design.studyDesign).toBe("evidence-synthesis");
        expect(design.evidenceType).toBe("review");
        expect(design.includedStudyDesign).toBe("observational");
    });

    it("recognizes a laboratory comparison as a preclinical experiment", () => {
        const design = classifyStudyDesign({
            title: "Manufacturing comparison",
            methods: "A laboratory comparison of cell-production techniques.",
            modelType: "observational",
        });
        expect(design.studyDesign).toBe("preclinical-experimental");
        expect(design.evidenceType).toBe("in-vitro");
        expect(design.includedStudyDesign).toBe("");
    });
});

describe("gap labels", () => {
    const gaps: ReportGap[] = [
        {
            title: "Pediatric solid-tumor safety remains unknown",
            description:
                "No evidence in the selected papers establishes safety for children with solid tumors.",
            whyItMatters: "Trials can miss the population.",
            citations: [1],
            confidence: "established",
        },
    ];

    it("does not call a selected-paper gap an established field-wide absence", () => {
        const qualified = qualifyReportGaps(gaps, []);
        expect(qualified[0].confidence).not.toBe("established");
        expect(qualified[0].scopeNote).toMatch(/not a documented field-wide absence/i);
        expect(qualified[0].scopeNote).toMatch(/do not include a verified passage/i);
    });

    it("flags hematologic papers cited for a pediatric solid-tumor gap", () => {
        const qualified = qualifyReportGaps(gaps, [
            extraction({
                index: 7,
                title: "Hematologic toxicity",
                methods: "Retrospective cohort of people with B-cell malignancies.",
                keyFindings: ["Toxicity occurred."],
            }),
        ].map((item) => ({
            ...item,
            index: 1,
        })));
        expect(qualified[0].scopeNote).toMatch(/indirect context/i);
        expect(qualified[0].confidence).toBe("suggested");
    });
});

describe("design mix", () => {
    it("labels a systematic review separately from a laboratory study", () => {
        expect(
            designMixLabel([
                { studyDesign: "evidence-synthesis" },
                { studyDesign: "preclinical-experimental" },
                { studyDesign: "observational" },
            ]),
        ).toBe(
            "1 evidence synthesis · 1 observational · 1 preclinical experiment",
        );
    });
});

describe("ledger counts", () => {
    it("counts located passages separately from direct support", () => {
        const counts = ledgerCounts([
            buildClaimRecord({
                claimText: "Antigen escape reduced detectable target cells.",
                quote: "",
                excerpt: intro,
                paperId: "10.1000/a",
                ordinal: 1,
            }),
            buildClaimRecord({
                claimText:
                    "Antigen escape reduced detectable target cells in solid-tumor cultures.",
                quote: "Antigen escape reduced detectable target cells in the solid-tumor cultures after infusion.",
                excerpt:
                    "Antigen escape reduced detectable target cells in the solid-tumor cultures after infusion.",
                paperId: "10.1000/b",
                ordinal: 1,
                question: "solid tumors",
                paperText: "adults with solid tumors",
            }),
        ]);
        expect(counts.total).toBe(2);
        expect(counts.located).toBe(1);
        expect(counts.directSupport).toBeLessThanOrEqual(counts.located);
    });
});
