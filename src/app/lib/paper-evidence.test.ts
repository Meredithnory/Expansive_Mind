import { describe, expect, it } from "vitest";
import {
    citedEvidenceQuote,
    gapEvidenceId,
    matchVerbatim,
    verifiedPaperEvidence,
} from "./paper-evidence";

const excerpt =
    "## Results\nUnder repeated low-density antigen stimulation, conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.  NKG2D/CD28 co-expression preserved killing through day 21 — a 3-fold improvement.";

describe("matchVerbatim", () => {
    it("finds the quote as the paper wrote it, despite spacing, quotes, and dashes", () => {
        expect(
            matchVerbatim(
                excerpt,
                "conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.",
            ),
        ).toBe("conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.");
        expect(
            matchVerbatim(excerpt, "NKG2D/CD28 co-expression preserved killing through day 21 - a 3-fold improvement..."),
        ).toBe("NKG2D/CD28 co-expression preserved killing through day 21 — a 3-fold improvement");
    });

    it("rejects a paraphrase and a fragment too short to point anywhere", () => {
        expect(matchVerbatim(excerpt, "CAR-T cells became exhausted after two weeks of stimulation.")).toBeNull();
        expect(matchVerbatim(excerpt, "day 14")).toBeNull();
    });
});

describe("verifiedPaperEvidence", () => {
    const items = [
        { finding: "Chronic low antigen exhausts CAR-T cells", quote: "conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3." },
        { finding: "Invented", quote: "This sentence is not in the paper at all, anywhere." },
        { finding: "Co-stimulation extends killing", quote: "NKG2D/CD28 co-expression preserved killing through day 21" },
    ];

    it("keeps only quotes found in the excerpt and numbers them per paper", () => {
        const evidence = verifiedPaperEvidence({ paperIndex: 3, excerpt, quotable: true, items });
        expect(evidence.map((item) => item.id)).toEqual(["E3.1", "E3.2"]);
        expect(evidence[1].finding).toBe("Co-stimulation extends killing");
    });

    it("keeps nothing for a paper whose license blocks quoting", () => {
        expect(verifiedPaperEvidence({ paperIndex: 3, excerpt, quotable: false, items })).toEqual([]);
    });
});

describe("citedEvidenceQuote", () => {
    const evidence = [
        { id: "E1.1", finding: "Chronic antigen exposure drives T cell exhaustion", quote: "Repeated stimulation raised PD-1 and TIM-3 on CAR-T cells." },
        { id: "E1.2", finding: "Dual targeting improves persistence", quote: "NKG2D/CD28 CAR-T cells persisted longer in low-antigen tumors." },
        { id: "E2.1", finding: "Other paper", quote: "Something from paper two, not paper one." },
    ];

    it("uses the evidence the report cited", () => {
        expect(citedEvidenceQuote(evidence, 1, { evidenceId: "E1.2" })).toBe(
            "NKG2D/CD28 CAR-T cells persisted longer in low-antigen tumors.",
        );
    });

    it("otherwise matches the chip's sentence to that paper's evidence", () => {
        expect(
            citedEvidenceQuote(evidence, 1, {
                context: "chronic antigen exposure drives T cell exhaustion and differentiation",
            }),
        ).toBe("Repeated stimulation raised PD-1 and TIM-3 on CAR-T cells.");
    });

    it("returns nothing rather than a weak guess or another paper's evidence", () => {
        expect(citedEvidenceQuote(evidence, 1, { context: "Clinical response rates were poor" })).toBeNull();
        expect(citedEvidenceQuote(evidence, 1, { evidenceId: "E2.1" })).toBeNull();
        expect(citedEvidenceQuote(undefined, 1, { evidenceId: "E1.1" })).toBeNull();
    });
});

describe("gapEvidenceId", () => {
    it("finds the gap's cited evidence for a paper", () => {
        const map = { "gaps.1.description": [null, "E4.2"], "gaps.1.whyItMatters": ["E6.1"] };
        expect(gapEvidenceId(map, 1, 4)).toBe("E4.2");
        expect(gapEvidenceId(map, 1, 6)).toBe("E6.1");
        expect(gapEvidenceId(map, 0, 4)).toBeNull();
    });
});
