import { describe, expect, it } from "vitest";
import type { OpportunityReport } from "./report-types";
import {
    SHARE_LOCKED_ERROR,
    attachClaimLedger,
    buildClaimLedger,
    evaluateClaimLedger,
    evaluateShareGate,
    isClaimLedgerRowComplete,
    shareLockDetail,
} from "./claim-ledger";

const papers = [
    {
        index: 1,
        paperId: "10.1/one",
        href: "/paperchatbot/springer/10.1/one",
        doi: "10.1/one",
    },
    {
        index: 2,
        paperId: "PMC99",
        href: "/paperchatbot/nih/PMC99",
    },
];

const extractions = [
    { index: 1, supportingExcerpt: "Events fell by 12% in the treatment arm." },
    { index: 2, supportingExcerpt: "No outcome past three years was reported." },
];

const completeReport: OpportunityReport = {
    sections: {
        stateOfScience: "Events fell [Paper 1].",
        gaps: [
            {
                title: "Durability unknown",
                description: "No trial reports outcomes beyond 3 years.",
                whyItMatters: "Chronic use is the intended setting.",
                citations: [1, 2],
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
                title: "Durability assay",
                thesis: "A lab test predicting loss of response could be licensed.",
                feasibilitySignals: "Assay methods are described.",
                risks: "Adoption is unproven.",
                citations: [2],
            },
        ],
        couldNotVerify: [],
        projectSeeds: [],
    },
};

describe("buildClaimLedger", () => {
    it("maps gaps, problems, and ventures onto rows with real excerpts", () => {
        const ledger = buildClaimLedger(completeReport, papers, extractions);

        expect(ledger.rows.map((row) => row.id)).toEqual([
            "gap-1-p1",
            "gap-1-p2",
            "problem-1-p1",
            "problem-1-p2",
            "venture-1-p2",
        ]);
        expect(ledger.rows[0]).toMatchObject({
            kind: "gap",
            claim: "Durability unknown",
            paperIndex: 1,
            doi: "10.1/one",
            quote: "Events fell by 12% in the treatment arm.",
            confidence: "suggested",
        });
        expect(ledger.rows[1].doi).toBeUndefined();
        expect(ledger.rows[1].paperId).toBe("PMC99");
        expect(ledger.rows[1].quote).toBe(
            "No outcome past three years was reported.",
        );
        expect(ledger.rows[2].kind).toBe("problem");
        expect(ledger.rows[4]).toMatchObject({
            kind: "venture",
            paperIndex: 2,
            quote: "No outcome past three years was reported.",
        });
        expect(ledger.rows.every(isClaimLedgerRowComplete)).toBe(true);
    });

    it("does not invent a quote when the extraction has no excerpt", () => {
        const ledger = buildClaimLedger(completeReport, papers, [
            { index: 1, supportingExcerpt: "Events fell by 12% in the treatment arm." },
        ]);
        const paper2 = ledger.rows.filter((row) => row.paperIndex === 2);
        expect(paper2.length).toBeGreaterThan(0);
        expect(paper2.every((row) => row.quote === "")).toBe(true);
        expect(paper2.every((row) => !isClaimLedgerRowComplete(row))).toBe(true);
    });

    it("marks a claim without a resolvable paper as incomplete", () => {
        const ledger = buildClaimLedger(
            {
                sections: {
                    ...completeReport.sections,
                    gaps: [
                        {
                            title: "Uncited gap",
                            description: "No paper backs this.",
                            whyItMatters: "",
                            citations: [],
                            confidence: "speculative",
                        },
                    ],
                    problems: [],
                    venturePotential: [],
                },
            },
            papers,
            extractions,
        );
        expect(ledger.rows).toHaveLength(1);
        expect(ledger.rows[0].paperIndex).toBeUndefined();
        expect(isClaimLedgerRowComplete(ledger.rows[0])).toBe(false);
    });
});

describe("evaluateClaimLedger / share gate", () => {
    it("opens share when every row has a quote and a paper citation", () => {
        const gate = evaluateShareGate(completeReport, papers, extractions);
        expect(gate.ok).toBe(true);
        expect(gate.reason).toBe("complete");
        expect(shareLockDetail(gate)).toBe("");
    });

    it("locks share when a quote is missing", () => {
        const gate = evaluateShareGate(completeReport, papers, [
            { index: 1, supportingExcerpt: "Events fell by 12% in the treatment arm." },
        ]);
        expect(gate.ok).toBe(false);
        expect(gate.reason).toBe("incomplete_rows");
        expect(gate.incompleteCount).toBeGreaterThan(0);
        expect(shareLockDetail(gate)).toContain(SHARE_LOCKED_ERROR);
    });

    it("locks share when the report is missing or has no claims", () => {
        expect(evaluateShareGate(undefined, papers, extractions)).toMatchObject({
            ok: false,
            reason: "missing_report",
        });
        const empty = evaluateClaimLedger({ rows: [] });
        expect(empty).toMatchObject({ ok: false, reason: "empty_ledger" });
        expect(shareLockDetail(empty)).toBe(
            "Share stays locked until this brief has sourced claims.",
        );
    });

    it("accepts paper id or href when DOI is missing", () => {
        const gate = evaluateShareGate(
            {
                sections: {
                    ...completeReport.sections,
                    gaps: [
                        {
                            title: "NIH-only gap",
                            description: "Cited to PMC.",
                            whyItMatters: "",
                            citations: [2],
                            confidence: "suggested",
                        },
                    ],
                    problems: [],
                    venturePotential: [],
                },
            },
            papers,
            extractions,
        );
        expect(gate.ok).toBe(true);
        expect(gate.ledger.rows[0].doi).toBeUndefined();
        expect(gate.ledger.rows[0].paperId).toBe("PMC99");
    });

    it("attaches a rebuilt ledger onto the report", () => {
        const attached = attachClaimLedger(completeReport, papers, extractions);
        expect(attached.claimLedger?.rows).toHaveLength(5);
        expect(attached.sections).toEqual(completeReport.sections);
    });
});
