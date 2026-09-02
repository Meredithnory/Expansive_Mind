import { describe, expect, it } from "vitest";
import {
    GUEST_UPGRADE_VIEW_MS,
    parseGuestDiscoveryResult,
    parseGuestOpportunityReport,
    shouldPromptGuestUpgrade,
} from "./guest-discovery";

const validReport = {
    sections: {
        stateOfScience: "GLP-1 agonists reduce major events [Paper 1].",
        gaps: [
            {
                title: "Durability unknown",
                description: "No trial reports outcomes beyond 3 years.",
                whyItMatters: "Chronic use is the intended setting.",
                citations: [1, "2"],
                confidence: "suggested",
            },
        ],
        problems: [
            {
                title: "Need a durability biomarker",
                description: "A validated marker would de-risk longer trials.",
                gapRefs: [1],
            },
        ],
        venturePotential: [
            {
                title: "Durability assay company",
                thesis: "A lab test predicting loss of response could be licensed.",
                feasibilitySignals: "Assay methods are described in Paper 2.",
                risks: "Reimbursement and clinical adoption are unproven.",
                citations: [2],
            },
        ],
        couldNotVerify: ["Full protocols were not in the licensed excerpts."],
        projectSeeds: [
            {
                title: "Meta-analyze durability endpoints",
                oneLiner: "Pool time-to-loss-of-response across the cited RCTs.",
                gapRef: 1,
            },
        ],
    },
};

const validResult = {
    id: "guest-1",
    createdAt: "2026-08-27T00:00:00.000Z",
    question: "How does GLP-1 affect cardiovascular outcomes?",
    brief: "## Consensus\nGLP-1 agonists reduce major events.",
    papers: [{ index: 1, title: "Example" }],
    meta: {
        papersUsed: 1,
        subQueriesUsed: ["cardiovascular GLP-1"],
        extractionFailureCount: 0,
    },
};

describe("parseGuestDiscoveryResult", () => {
    it("accepts a stored guest synthesis", () => {
        expect(parseGuestDiscoveryResult(validResult)?.question).toBe(
            validResult.question,
        );
    });

    it("rejects an empty or incomplete payload", () => {
        expect(parseGuestDiscoveryResult(null)).toBeNull();
        expect(parseGuestDiscoveryResult({ ...validResult, brief: "" })).toBeNull();
        expect(
            parseGuestDiscoveryResult({ ...validResult, papers: "nope" }),
        ).toBeNull();
    });

    it("carries a structured report, extractions, and newer meta fields", () => {
        const parsed = parseGuestDiscoveryResult({
            ...validResult,
            report: validReport,
            extractions: [
                {
                    index: 1,
                    title: "Example trial",
                    sourceLabel: "Springer Nature",
                    authors: ["A. Author"],
                    publicationDate: "2024",
                    keyFindings: ["12% reduction"],
                    methods: "RCT",
                    limitations: ["Small n"],
                    openQuestions: [],
                    evidenceType: "rct",
                    supportingExcerpt: "Events fell by 12% in the treatment arm.",
                },
            ],
        });
        expect(parsed?.report?.sections.gaps[0].citations).toEqual([1, 2]);
        expect(parsed?.report?.sections.projectSeeds[0].gapRef).toBe(1);
        expect(parsed?.meta?.subQueriesUsed).toEqual(["cardiovascular GLP-1"]);
        expect(parsed?.meta?.extractionFailureCount).toBe(0);
        expect(parsed?.extractions?.[0].evidenceType).toBe("rct");
        expect(parsed?.extractions?.[0].supportingExcerpt).toContain("12%");
    });

    it("keeps old saves that have no report", () => {
        const parsed = parseGuestDiscoveryResult(validResult);
        expect(parsed).not.toBeNull();
        expect(parsed?.report).toBeUndefined();
    });

    it("drops a malformed report and still returns the brief payload", () => {
        const parsed = parseGuestDiscoveryResult({
            ...validResult,
            report: { sections: { gaps: [{ title: "" }] } },
        });
        expect(parsed?.brief).toBe(validResult.brief);
        expect(parsed?.report).toBeUndefined();
    });
});

describe("parseGuestOpportunityReport", () => {
    it("accepts a flat report object and defaults invalid confidence", () => {
        const parsed = parseGuestOpportunityReport({
            stateOfScience: "A cited answer.",
            gaps: [
                {
                    title: "Gap",
                    description: "Missing data.",
                    citations: [1],
                    confidence: "wild",
                },
            ],
        });
        expect(parsed?.sections.stateOfScience).toBe("A cited answer.");
        expect(parsed?.sections.gaps[0].confidence).toBe("suggested");
    });

    it("returns undefined when the payload has no usable sections", () => {
        expect(parseGuestOpportunityReport({})).toBeUndefined();
        expect(parseGuestOpportunityReport(null)).toBeUndefined();
    });

    it("recovers a report from a raw JSON brief string", () => {
        const parsed = parseGuestOpportunityReport(JSON.stringify(validReport));
        expect(parsed?.sections.gaps[0].title).toBe("Durability unknown");
        expect(parsed?.sections.projectSeeds[0].gapRef).toBe(1);
    });

    it("recovers a truncated JSON brief into formatted sections", () => {
        const truncated = `{"sections": {"stateOfScience": "The literature addresses bone marrow-related tissue engineering.", "gaps": [{"title": "Lack of integrated artificial bone marrow niche systems", "description": "The papers describe scaffold-based bone regeneration.", "whyItMatters": "A full niche is required.", "citations": [2, 4, 6], "confidence": "established"}, {"title": "Incomplete understanding of signaling"`;
        const parsed = parseGuestOpportunityReport(truncated);
        expect(parsed?.sections.stateOfScience).toContain("bone marrow");
        expect(parsed?.sections.gaps[0].title).toContain("integrated artificial");
    });
});

describe("shouldPromptGuestUpgrade", () => {
    it("waits until the guest has had time to read", () => {
        expect(
            shouldPromptGuestUpgrade({
                elapsedMs: 1_000,
                analysisWasBelowFold: false,
                analysisIsVisible: true,
            }),
        ).toBe(false);
        expect(
            shouldPromptGuestUpgrade({
                elapsedMs: GUEST_UPGRADE_VIEW_MS,
                analysisWasBelowFold: false,
                analysisIsVisible: true,
            }),
        ).toBe(true);
    });

    it("prompts once they scroll the analysis into view from below the fold", () => {
        expect(
            shouldPromptGuestUpgrade({
                elapsedMs: 800,
                analysisWasBelowFold: true,
                analysisIsVisible: true,
            }),
        ).toBe(true);
        expect(
            shouldPromptGuestUpgrade({
                elapsedMs: 800,
                analysisWasBelowFold: true,
                analysisIsVisible: false,
            }),
        ).toBe(false);
    });
});
