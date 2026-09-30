import { describe, expect, it } from "vitest";
import { buildBriefView, toBriefExtractions } from "./brief-view";
import type { OpportunityReportSections } from "../api/discover/report-types";

const SLUG = "AbCdEfGhIjKl";

const sections: OpportunityReportSections = {
    stateOfScience:
        "Base editors avoid double-strand breaks [Paper 1]. Only 43% of studies assessed off-target effects [Paper 2].",
    gaps: [
        {
            title: "No standardized guidelines",
            description: "Assays differ across studies [Paper 2].",
            whyItMatters: "",
            citations: [2, 1, 2],
            confidence: "suggested",
        },
    ],
    problems: [],
    venturePotential: [],
    couldNotVerify: [],
    projectSeeds: [],
    citationEvidence: { stateOfScience: ["E1.1", null], "gaps.0.description": ["E2.1"] },
};

const papers = [
    {
        index: 1,
        title: "Off-target editing by base editors",
        href: "/paperchatbot/nih/PMC1",
        sourceLabel: "NIH PubMed Central",
        authors: ["A", "B", "C", "D"],
        date: "2019",
    },
    {
        index: 2,
        title: "Gene editing in livestock",
        href: "/paperchatbot/nih/PMC2",
        sourceLabel: "NIH PubMed Central",
        authors: ["E"],
        date: "2023",
    },
];

const extractions = toBriefExtractions([
    {
        index: 1,
        population: "human cells",
        evidence: [{ id: "E1.1", finding: "x", quote: "Base editors do not create double strand breaks." }],
    },
    {
        index: 2,
        population: "genome-edited livestock",
        evidence: [{ id: "E2.1", finding: "y", anchor: { hash: "abc123", length: 60 } }],
    },
]);

function view() {
    return buildBriefView({
        slug: SLUG,
        question: "How are off-target effects of gene editing assessed?",
        sections,
        papers,
        extractions,
        ledger: {
            rows: [
                {
                    id: "gap-1",
                    kind: "gap",
                    claim: "No standardized guidelines",
                    sources: [
                        { paperIndex: 1, quote: "A quote.", licenseUrl: "x" },
                        { paperIndex: 2, quote: "" },
                    ],
                },
                { id: "problem-1", kind: "problem", claim: "Other", sources: [] },
            ],
        },
    });
}

describe("buildBriefView", () => {
    it("links summary chips to the reader at the cited sentence, from this brief", () => {
        const chips = view().summary.filter((segment) => segment.type === "cite");
        expect(chips).toHaveLength(2);
        const first = new URL(chips[0].type === "cite" ? chips[0].href : "", "https://x");
        expect(first.pathname).toBe("/paperchatbot/nih/PMC1");
        expect(first.searchParams.get("focus")).toBe(
            "Base editors do not create double strand breaks.",
        );
        expect(first.searchParams.get("from")).toBe("brief");
        expect(first.searchParams.get("brief")).toBe(SLUG);
        expect(first.searchParams.get("claim")).toBe("Base editors avoid double-strand breaks");
        const second = new URL(chips[1].type === "cite" ? chips[1].href : "", "https://x");
        expect(second.searchParams.get("focus")).toBeNull();
        expect(second.searchParams.get("claim")).toBe(
            "Only 43% of studies assessed off-target effects",
        );
    });

    it("notes only the cited papers that studied a narrower group", () => {
        const result = view();
        expect(result.narrowNotes).toEqual([{ index: 2, scope: "genome-edited livestock" }]);
        expect(result.papers[0].scope).toBeUndefined();
        expect(result.papers[1].scope).toBe("genome-edited livestock");
    });

    it("builds gap chips once per paper, opening at the gap's evidence", () => {
        const [gap] = view().gaps;
        expect(gap.papers.map((paper) => paper.index)).toEqual([2, 1]);
        const url = new URL(gap.papers[0].href, "https://x");
        expect(url.searchParams.get("anchor")).toBe("abc123.60");
        expect(url.searchParams.get("claim")).toBe("No standardized guidelines");
        expect(gap.description.some((segment) => segment.type === "cite")).toBe(true);
    });

    it("counts claims and quoted papers from the ledger", () => {
        const result = view();
        expect(result.claimCount).toBe(2);
        expect(result.quotedCount).toBe(1);
        expect(result.papers.map((paper) => paper.quoted)).toEqual([true, false]);
        expect(result.papers[0].meta).toBe("A, B, C et al. · NIH PubMed Central · 2019");
    });
});
