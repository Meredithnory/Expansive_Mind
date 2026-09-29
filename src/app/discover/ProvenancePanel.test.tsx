import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProvenancePanel from "./ProvenancePanel";
import type { OpportunityReport } from "../api/discover/report-types";
import type { ProvenancePaper } from "./paper-provenance";

const papers: ProvenancePaper[] = [
    {
        index: 1,
        database: "nih",
        paperId: "1234567",
        idName: "pmcid",
        title: "Senolytic clearance in aged mice",
        sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/",
        href: "/paperchatbot/nih/1234567",
        doi: "10.1000/seno",
        indexedBy: ["OpenAlex"],
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        quoteGate: "ok",
    },
    {
        index: 2,
        database: "springer",
        paperId: "10.1007/abc",
        idName: "doi",
        title: "Dosing senolytics in older adults",
        sourceUrl: "https://link.springer.com/article/10.1007/abc",
        href: "/paperchatbot/springer/10.1007/abc",
        quoteGate: "license_not_commercial_friendly",
    },
];

const report: OpportunityReport = {
    sections: {
        stateOfScience: "Clearance improved gait in aged mice [Paper 1].",
        gaps: [],
        problems: [],
        venturePotential: [],
        couldNotVerify: [],
        projectSeeds: [],
    },
};

describe("ProvenancePanel", () => {
    const html = renderToStaticMarkup(
        <ProvenancePanel papers={papers} report={report} brief="" />,
    );

    it("shows source, PMCID, link, citing claims, and quote status per paper", () => {
        expect(html).toContain("NIH PubMed Central");
        expect(html).toContain("Found via OpenAlex");
        expect(html).toContain('href="https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/"');
        expect(html).toContain('href="https://doi.org/10.1000/seno"');
        expect(html).toContain("Clearance improved gait in aged mice.");
        expect(html).toContain("CC BY 4.0");
        expect(html).toContain("Springer Nature");
        expect(html).toContain("None recorded");
        expect(html).toContain("License is not CC0, CC BY, CC BY-SA, or CC BY-ND.");
        expect(html).toContain("Not cited in the write-up.");
        expect(html).toContain("2 papers · 1 allowed · 1 blocked");
    });

    it("opens external links in a new tab without an opener", () => {
        expect(html).toMatch(/href="https:\/\/doi\.org\/10\.1000\/seno" target="_blank" rel="noopener noreferrer"/);
    });

    it("renders no paper text", () => {
        expect(html).not.toContain("<blockquote");
    });
});
