import { describe, expect, it } from "vitest";
import { calculateFounderScenario, parseFounderReport, SCENARIO_FIELDS, VENTURE_SCORE_CRITERIA, rankFounderOptions, scoreFounderOption, founderReportMarkdown, type ScenarioInputs } from "./founder-report";
import { parseGuestOpportunityReport } from "./guest-discovery";

const source = { id: "Source 1", title: "Primary evidence", url: "https://www.sec.gov/example", retrievedAt: "2026-09-07", text: "The company reported operating losses for the financial year." };
const fixture = { version: 1, generatedAt: "2026-09-07", scope: "US labs", sources: [source], areas: [{ id: "capital", findings: [{ claim: "The company reported losses.", sourceId: source.id, quote: source.text }], analysis: "A new venture would need its own budget." }] };

describe("venture prioritization", () => {
    const option = (title: string, rating: number, omitted: string[] = []) => ({ title, customer: "", product: "", upside: "", risk: "", nextMilestone: "", assessments: VENTURE_SCORE_CRITERIA.filter(criterion => !omitted.includes(criterion.id)).map(criterion => ({ id: criterion.id, rating, rationale: "Synthetic rating for arithmetic tests, not a real investment judgment.", evidence: [{ sourceId: source.id, quote: source.text }] })) });
    it("computes fixed weighted scores, ignoring model totals and winners", () => {
        const report = parseFounderReport({ ...fixture, preferred: 1, options: [{ ...option("Strong", 4), score: 1 }, { ...option("Weak", 2), score: 100 }] })!;
        const ranking = rankFounderOptions(report.options);
        expect(VENTURE_SCORE_CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0)).toBe(100);
        expect(ranking.entries.map(entry => entry.score)).toEqual([75, 25]);
        expect(ranking.preferred).toBe(0);
        expect(founderReportMarkdown(report)).toContain("First to validate under this rubric: Strong");
    });
    it("leaves unsupported or out-of-range ratings unknown across restoration", () => {
        const raw = option("Invalid", 5);
        raw.assessments[0].evidence[0].quote = "Invented evidence never supplied to the report.";
        raw.assessments[1].rating = 6;
        const parsed = parseFounderReport({ ...fixture, options: [raw] })!;
        expect(parsed.options[0].assessments?.slice(0, 2).map(entry => entry.rating)).toEqual([null, null]);
        expect(scoreFounderOption(parsed.options[0]).coverage).toBe(55);
        const restored = parseGuestOpportunityReport({ sections: { stateOfScience: "Science" }, founder: parsed })!;
        expect(restored.founder?.options[0].assessments).toEqual(parsed.options[0].assessments);
        expect(rankFounderOptions(restored.founder!.options).entries[0].rank).toBeNull();
    });
    it("does not crown a sparse perfect score over an assessed option", () => {
        const ranking = rankFounderOptions([option("Sparse", 5, ["demand", "technical", "market", "capital", "execution"]), option("Assessed", 3)]);
        expect(ranking.entries[0].option.title).toBe("Assessed");
        expect(ranking.entries[1]).toMatchObject({ score: 100, coverage: 15, lower: 15, upper: 100, rank: null });
        expect(ranking.preferred).toBeNull();
    });
    it("does not invent a winner for ties or overlapping unknown ranges", () => {
        const tied = rankFounderOptions([option("A", 4), option("B", 4)]);
        expect(tied.entries.map(entry => entry.rank)).toEqual([1, 1]);
        expect(tied.preferred).toBeNull();
        const uncertain = rankFounderOptions([option("A", 4, ["market"]), option("B", 4)]);
        expect(uncertain.preferred).toBeNull();
    });
    it("withholds endorsement for weak options, critical barriers, and single options", () => {
        expect(rankFounderOptions([option("A", 3), option("B", 2)]).preferred).toBeNull();
        expect(rankFounderOptions([option("Only option", 5)]).preferred).toBeNull();
        const blocked = option("Critical barrier", 5);
        blocked.assessments.find(criterion => criterion.id === "technical")!.rating = 1;
        const ranked = rankFounderOptions([blocked, option("Other", 2)]);
        expect(ranked.entries[0].criticalBarrier).toBe(true);
        expect(ranked.preferred).toBeNull();
    });
    it("keeps legacy reports unscored instead of assigning defaults", () => {
        const report = parseFounderReport({ ...fixture, options: [{ title: "Old option" }] })!;
        expect(scoreFounderOption(report.options[0])).toMatchObject({ score: null, coverage: 0, lower: 0, upper: 100, eligible: false });
        expect(founderReportMarkdown(report)).toContain("Not scored");
    });
});
describe("founder source provenance", () => {
    it("keeps matching quotes, rejects invented quotes and source IDs, and never accepts an investment-ready status", () => {
        const report = parseFounderReport({ ...fixture, status: "invest", areas: [{ ...fixture.areas[0], findings: [
            ...fixture.areas[0].findings,
            { claim: "Profitable", sourceId: source.id, quote: "The company reported a billion dollars in profit." },
            { claim: "Another source", sourceId: "Source 999", quote: source.text },
        ] }] })!;
        expect(report.status).toBe("needs-validation");
        expect(report.areas.find(area => area.id === "capital")?.findings).toHaveLength(1);
        expect(report.areas).toHaveLength(8);
    });
    it("rejects unsafe source links and their dependent findings", () => {
        const report = parseFounderReport({ ...fixture, sources: [{ ...source, url: "javascript:alert(1)" }] })!;
        expect(report.sources).toHaveLength(0);
        expect(report.areas.every(area => area.findings.length === 0)).toBe(true);
    });
    it("preserves founder diligence through guest restoration and includes it in export", () => {
        const report = parseGuestOpportunityReport({ sections: { stateOfScience: "Science summary" }, founder: fixture })!;
        expect(report.founder?.scope).toBe("US labs");
        expect(founderReportMarkdown(report.founder!)).toContain(source.url);
        expect(parseGuestOpportunityReport({ sections: { stateOfScience: "Old report" } })?.founder).toBeUndefined();
    });
});

describe("founder financial scenarios", () => {
    const empty = Object.fromEntries(SCENARIO_FIELDS.map(([key]) => [key, null])) as ScenarioInputs;
    it("never turns missing assumptions into zero-dollar forecasts", () => {
        expect(calculateFounderScenario(empty)).toEqual({ revenue: null, operatingProfit: null, fundingRequired: null });
        expect(calculateFounderScenario({ ...empty, customers: 100, price: 1000 }).operatingProfit).toBeNull();
    });
    it("separates revenue, operating profit, and additional cash required", () => {
        expect(calculateFounderScenario({ customers: 100, price: 1000, grossMargin: 60, annualOpex: 80000,
            monthlyBurn: 10000, months: 12, oneTimeCosts: 30000, contingency: 20, cashAvailable: 50000,
        })).toEqual({ revenue: 100000, operatingProfit: -20000, fundingRequired: 130000 });
    });
    it("rejects invalid margins and non-finite costs and accepts explicit zero revenue", () => {
        expect(calculateFounderScenario({ ...empty, customers: 0, price: 1000 }).revenue).toBe(0);
        expect(calculateFounderScenario({ ...empty, customers: 100, price: 1000, grossMargin: 101, annualOpex: 0 }).operatingProfit).toBeNull();
        expect(calculateFounderScenario({ ...empty, customers: Infinity, price: 1000 }).revenue).toBeNull();
        expect(calculateFounderScenario({ ...empty, monthlyBurn: 0, months: 12, oneTimeCosts: 0, contingency: 0, cashAvailable: 100 }).fundingRequired).toBe(0);
    });
});
