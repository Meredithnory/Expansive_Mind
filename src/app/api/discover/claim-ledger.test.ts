import { describe, expect, it, vi } from "vitest";
import { buildClaimLedger, evaluateShareGate } from "./claim-ledger";
import { parseOpportunityReport } from "./synthesize";
import type { OpportunityReport } from "./report-types";

vi.mock("server-only", () => ({}));

const papers = [{ index: 1, paperId: "PMC99", href: "/paperchatbot/nih/PMC99",
    database: "nih" as const, licenseUrl: "https://creativecommons.org/licenses/by/4.0/" }];
const quotes = ["Follow-up ended at three years.", "A marker requires prospective validation.",
    "The assay was feasible but adoption was not evaluated."];
const extractions = [{ index: 1, supportingExcerpt: quotes.join(" ") }];
function fixture(): OpportunityReport {
    const report: OpportunityReport = { sections: {
        stateOfScience: "Evidence is limited.",
        gaps: [{ title: "Durability", description: "Follow-up ends at three years.",
            whyItMatters: "Long-term outcomes remain unknown.", citations: [1], confidence: "suggested" }],
        problems: [{ title: "Validation", description: "A marker needs validation.", gapRefs: [1] }],
        venturePotential: [{ title: "Assay", thesis: "Possible translation.",
            feasibilitySignals: "Feasible assay.", risks: "Adoption unknown.", citations: [1] }],
        couldNotVerify: [], projectSeeds: [],
    } };
    report.claimEvidence = buildClaimLedger(report, papers, []).rows.map((row, i) =>
        ({ rowId: row.id, claim: row.claim, quote: quotes[i] }));
    return report;
}
describe("claim-specific ledger", () => {
    it("maps distinct gap/problem/venture quotes from the same licensed source", () => {
        const report = parseOpportunityReport(fixture())!;
        const gate = evaluateShareGate(report, papers, extractions);
        expect(gate.ok).toBe(true);
        expect(gate.ledger.rows.map(row => row.quote)).toEqual(quotes);
        expect(gate.ledger.rows[0].claim).toContain("Long-term outcomes");
        expect(gate.ledger.rows[2].claim).toContain("Adoption unknown");
    });
    it.each(["missing", "invented", "wrong-paper", "duplicate", "reused", "stale", "oversize"])(
        "blocks %s mappings", (mode) => {
            const report = fixture();
            const evidence = report.claimEvidence!;
            if (mode === "missing") report.claimEvidence = [];
            if (mode === "invented") evidence[0].quote = "Invented outcome.";
            if (mode === "wrong-paper") evidence[0].rowId = "gap-1-p2";
            if (mode === "duplicate") evidence.push({ ...evidence[0] });
            if (mode === "reused") evidence[1].quote = evidence[0].quote;
            if (mode === "stale") report.sections.gaps[0].whyItMatters = "Changed assertion.";
            if (mode === "oversize") evidence[0].quote = "x".repeat(1201);
            expect(evaluateShareGate(report, papers, extractions).ok).toBe(false);
        });
    it("ignores forged ledger rows and never falls back to generic snippets", () => {
        const report = fixture();
        report.claimLedger = buildClaimLedger(report, papers, extractions);
        delete report.claimEvidence;
        expect(evaluateShareGate(report, papers, extractions).ok).toBe(false);
    });
    it("normalizes whitespace while retaining verbatim words", () => {
        const report = fixture();
        report.claimEvidence![0].quote = "Follow-up  ended\nat three years.";
        expect(evaluateShareGate(report, papers, extractions).ok).toBe(true);
    });
    it("blocks missing citations, excerpts, unlicensed sources and Scholar", () => {
        const report = fixture();
        expect(evaluateShareGate(report, papers, []).ok).toBe(false);
        for (const licenseUrl of ["", "https://creativecommons.org/licenses/by-nc/4.0/"]) {
            expect(evaluateShareGate(report, [{ ...papers[0], licenseUrl }], extractions).ok).toBe(false);
        }
        expect(evaluateShareGate(report, [{ ...papers[0], database: "scholar" }], extractions).ok).toBe(false);
        report.sections.gaps[0].citations.push(99);
        expect(evaluateShareGate(report, papers, extractions).ok).toBe(false);
    });
});
