import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PaperProvenanceSection from "./PaperProvenanceSection";
import { paperProvenance, type ProvenancePaper } from "./paper-provenance";
import type { OpportunityReport } from "../api/discover/report-types";

const papers: ProvenancePaper[] = [
    {
        index: 1,
        database: "nih",
        paperId: "10034092",
        idName: "pmcid",
        title: "Off-target effects in CRISPR/Cas9 gene editing",
        sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10034092/",
        href: "/paperchatbot/nih/10034092",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        quoteGate: "ok",
    },
    {
        index: 2,
        database: "springer",
        paperId: "10.1007/x",
        idName: "doi",
        title: "A Springer paper",
        sourceUrl: "https://link.springer.com/article/10.1007/x",
        href: "/paperchatbot/springer/10.1007/x",
        quoteGate: "null_license",
    },
];

const report: OpportunityReport = {
    sections: {
        stateOfScience: "Off-target cuts remain hard to detect in cells [Paper 1].",
        gaps: [],
        problems: [],
        venturePotential: [],
        couldNotVerify: [],
        projectSeeds: [],
    },
};

const [first, second] = paperProvenance(papers, report, "", [
    { index: 1, evidence: [{ id: "E1.1", finding: "Detection in cells is hard", anchor: { hash: "ab12", length: 90 } }] },
]);

describe("PaperProvenanceSection", () => {
    it("shows the PMCID, the quote status, and each citing claim linked into the paper", () => {
        const html = renderToStaticMarkup(
            <PaperProvenanceSection paper={papers[0]} row={first} reportReturn={{ view: "papers" }} />,
        );
        expect(html).toContain('href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10034092/"');
        expect(html).toContain("CC BY 4.0");
        expect(html).toContain("Cited in the report · 1");
        expect(html).toMatch(/href="\/paperchatbot\/nih\/10034092\?[^"]*chat=off/);
        expect(html).toContain("Show in paper");
        expect(html).not.toContain("<blockquote");
    });

    it("says why a quote is blocked and when nothing cites the paper", () => {
        const html = renderToStaticMarkup(<PaperProvenanceSection paper={papers[1]} row={second} />);
        expect(html).toContain("None recorded");
        expect(html).toContain("License unknown. Unknown licenses are not quoted.");
        expect(html).toContain("Not cited in the write-up.");
    });
});
