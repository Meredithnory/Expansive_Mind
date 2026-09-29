import { describe, expect, it } from "vitest";
import type { OpportunityReport } from "../api/discover/report-types";
import {
    claimsByPaper,
    paperProvenance,
    quoteStatus,
    type ProvenancePaper,
} from "./paper-provenance";

function paper(overrides: Partial<ProvenancePaper> = {}): ProvenancePaper {
    return {
        index: 1,
        database: "nih",
        paperId: "1234567",
        idName: "pmcid",
        title: "Senolytic clearance in aged mice",
        sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/",
        href: "/paperchatbot/nih/1234567",
        ...overrides,
    };
}

const report: OpportunityReport = {
    sections: {
        stateOfScience:
            "Clearing senescent cells improved gait in aged mice [Paper 1]. Human data are thin [Papers 1, 2].\nNo trial has tested dosing.",
        gaps: [
            {
                title: "Dosing in older adults is untested",
                description: "Only mouse schedules exist [Paper 2].",
                whyItMatters: "Dose drives toxicity.",
                citations: [1],
                confidence: "suggested",
            },
        ],
        problems: [
            {
                title: "Trial design lacks a dose anchor",
                description: "Sponsors cannot pick a starting dose.",
                gapRefs: [1],
            },
        ],
        venturePotential: [
            {
                title: "Dose-finding biomarker",
                thesis: "A senescence readout could anchor dose [Paper 2].",
                feasibilitySignals: "",
                risks: "",
                citations: [],
            },
        ],
        couldNotVerify: ["Whether the gait effect lasts past 12 weeks [Paper 1]."],
        projectSeeds: [],
    },
};

describe("claimsByPaper", () => {
    it("lists every place the write-up cites a paper, in reading order", () => {
        const claims = claimsByPaper(report, "", 2);
        expect(claims.get(1)).toEqual([
            { where: "State of the science", text: "Clearing senescent cells improved gait in aged mice." },
            { where: "State of the science", text: "Human data are thin." },
            { where: "Gap 1", text: "Dosing in older adults is untested" },
            { where: "What we could not verify", text: "Whether the gait effect lasts past 12 weeks." },
        ]);
        expect(claims.get(2)).toEqual([
            { where: "State of the science", text: "Human data are thin." },
            { where: "Gap 1", text: "Dosing in older adults is untested" },
            { where: "Translation 1", text: "Dose-finding biomarker" },
        ]);
    });

    it("does not credit a problem with the papers of the gap it points to", () => {
        const all = [...claimsByPaper(report, "", 2).values()].flat();
        expect(all.some((claim) => claim.where.startsWith("Problem"))).toBe(false);
    });

    it("ignores citations to papers the run does not have", () => {
        const claims = claimsByPaper(report, "", 1);
        expect(claims.get(2)).toBeUndefined();
        expect(claims.get(1)?.map((claim) => claim.where)).toContain("Gap 1");
    });

    it("reads a markdown brief when the discovery has no structured report", () => {
        const claims = claimsByPaper(null, "## Summary\n- **Gait improved** in mice [Paper 1].", 1);
        expect(claims.get(1)).toEqual([{ where: "Brief", text: "Gait improved in mice." }]);
    });
});

describe("quoteStatus", () => {
    it("allows a quote only with a commercial-friendly license on the card", () => {
        expect(
            quoteStatus(
                paper({
                    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
                    quoteGate: "ok",
                }),
            ),
        ).toEqual({ status: "allowed", label: "Allowed", detail: "CC BY 4.0" });
    });

    it("explains each blocked reason", () => {
        expect(quoteStatus(paper({ quoteGate: "null_license" }))).toMatchObject({
            status: "blocked",
            detail: "License unknown. Unknown licenses are not quoted.",
        });
        expect(
            quoteStatus(paper({ quoteGate: "license_not_commercial_friendly" })).detail,
        ).toBe("License is not CC0, CC BY, CC BY-SA, or CC BY-ND.");
        expect(quoteStatus(paper({ quoteGate: "abstract_only" })).status).toBe("blocked");
        expect(quoteStatus(paper({ quoteGate: "missing_attribution" })).status).toBe("blocked");
    });

    it("says nothing was quoted when the license allowed it but no passage was picked", () => {
        expect(quoteStatus(paper({ quoteGate: "no_passage" }))).toEqual({
            status: "allowed",
            label: "Allowed",
            detail: "No passage was quoted.",
        });
    });

    it("fails closed when the gate says ok but the card has no usable license", () => {
        expect(quoteStatus(paper({ quoteGate: "ok" }))).toMatchObject({
            status: "blocked",
            detail: "License unknown. Unknown licenses are not quoted.",
        });
        expect(
            quoteStatus(
                paper({
                    quoteGate: "ok",
                    licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
                }),
            ).status,
        ).toBe("blocked");
    });

    it("keeps a block when a license URI is present but the gate blocked it", () => {
        expect(
            quoteStatus(
                paper({
                    quoteGate: "license_conflict",
                    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
                }),
            ).status,
        ).toBe("blocked");
    });

    it("blocks Scholar papers from runs saved before the gate was recorded", () => {
        expect(
            quoteStatus(paper({ database: "scholar", idName: "cluster_id" })),
        ).toMatchObject({ status: "blocked", detail: expect.stringMatching(/snippet/) });
    });

    it("says so when an older run did not record the reason", () => {
        expect(quoteStatus(paper())).toEqual({
            status: "unrecorded",
            label: "Not quoted",
            detail: "Reason not recorded for this run.",
        });
    });
});

describe("paperProvenance", () => {
    it("shows the home source, the indexes that found it, its PMCID, and a DOI link", () => {
        const [row] = paperProvenance(
            [paper({ doi: "10.1038/s41591-026-0001", indexedBy: ["OpenAlex", "Europe PMC"] })],
            report,
            "",
        );
        expect(row).toMatchObject({
            index: 1,
            source: "NIH PubMed Central",
            foundVia: ["OpenAlex", "Europe PMC"],
            pmcid: {
                id: "PMC1234567",
                href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/",
            },
            link: {
                href: "https://doi.org/10.1038/s41591-026-0001",
                label: "doi.org/10.1038/s41591-026-0001",
                external: true,
            },
        });
    });

    it("records no PMCID for a Springer paper and links its source page", () => {
        const [row] = paperProvenance(
            [
                paper({
                    database: "springer",
                    paperId: "10.1007/abc",
                    idName: "doi",
                    doi: undefined,
                    sourceUrl: "https://link.springer.com/article/10.1007/abc",
                    href: "/paperchatbot/springer/10.1007/abc",
                }),
            ],
            null,
            "",
        );
        expect(row.source).toBe("Springer Nature");
        expect(row.pmcid).toBeNull();
        expect(row.link).toEqual({
            href: "https://link.springer.com/article/10.1007/abc",
            label: "link.springer.com",
            external: true,
        });
    });

    it("does not repeat the home source as a finding index", () => {
        const [row] = paperProvenance(
            [paper({ database: "scholar", idName: "cluster_id", indexedBy: ["Google Scholar"] })],
            null,
            "",
        );
        expect(row.source).toBe("Google Scholar");
        expect(row.foundVia).toEqual([]);
        expect(row.pmcid).toBeNull();
    });
});
