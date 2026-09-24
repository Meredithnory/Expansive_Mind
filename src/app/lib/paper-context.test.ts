import { describe, expect, it } from "vitest";
import type { FormattedPaper } from "../api/general-interfaces";
import { selectPaperContext } from "./paper-context";

const paper: FormattedPaper = {
    title: "Example",
    authors: ["Researcher"],
    paperId: "1",
    idName: "pmcid",
    primarySource: "NIH PubMed Central",
    source: "nih",
    paper: [
        {
            title: "Abstract",
            content: "The treatment reduced inflammation.",
            subSections: [],
        },
        {
            title: "Results",
            content: "Inflammation decreased in the treatment group.",
            subSections: [],
        },
        {
            title: "References",
            content: "A very long bibliography that must not be transmitted.",
            subSections: [],
        },
    ],
    access: {
        rawLicense: "CC BY 4.0",
        normalizedLicense: "CC-BY",
        licenseName: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        canonicalUrl: "https://example.com",
        attribution: {
            title: "Example",
            authors: ["Researcher"],
            sourceLabel: "NIH PubMed Central",
            canonicalUrl: "https://example.com",
            paperId: "1",
            idName: "pmcid",
        },
        policyReason: "Allowed",
        policyReasonCode: "allowed_cc_by",
        canDisplayFullText: true,
        canSendToAI: true,
        canPersistContent: true,
        canUseImages: false,
    },
};

describe("selectPaperContext", () => {
    it("selects relevant sections and excludes references", () => {
        const context = selectPaperContext(
            paper,
            "Did treatment reduce inflammation?",
        );
        expect(context).toContain("## Abstract\n");
        expect(context).toContain("## Results\n");
        expect(context).not.toContain("bibliography");
    });

    it("skips the Abstract when a methods question can use a methods section", () => {
        const withMethods = {
            ...paper,
            paper: [
                ...paper.paper,
                {
                    title: "Methods",
                    content: "Mice were transfected with Lipofectamine.",
                    subSections: [],
                },
            ],
        };
        const context = selectPaperContext(
            withMethods,
            "Where is the key method described?",
        );
        expect(context).toContain("## Methods");
        expect(context).not.toContain("## Abstract");
    });

    it("caps the complete context", () => {
        const oversized = {
            ...paper,
            paper: Array.from({ length: 8 }, (_, index) => ({
                title: `Results ${index}`,
                content: "Finding. ".repeat(2_000),
                subSections: [],
            })),
        };
        expect(selectPaperContext(oversized, "finding").length).toBeLessThanOrEqual(
            6_001,
        );
    });

    it("includes figure captions when the question asks about figures", () => {
        const withFigures = {
            ...paper,
            figures: [
                {
                    id: "fig-1",
                    label: "FIGURE 1",
                    caption:
                        "Consensual algorithm for the management of melasma.",
                    sectionTitle: "Results",
                    hasSeparateRights: false,
                    canAnalyzeSourceImage: false,
                },
            ],
        };
        const context = selectPaperContext(
            withFigures,
            "Walk me through the key figure.",
        );
        expect(context).toContain("## Figures in this paper");
        expect(context).toContain("FIGURE 1");
        expect(context).toContain("Consensual algorithm");
    });

    it("states when no figure captions exist for a figure question", () => {
        const context = selectPaperContext(
            paper,
            "Walk me through the key figure.",
        );
        expect(context).toContain("No figure captions are present");
    });

    it("keeps figure captions ahead of the context budget when asked about figures", () => {
        const oversized = {
            ...paper,
            figures: [
                {
                    id: "fig-1",
                    label: "FIGURE 1",
                    caption:
                        "Consensual algorithm for the management of melasma.",
                    sectionTitle: "Results",
                    hasSeparateRights: false,
                    canAnalyzeSourceImage: false,
                },
            ],
            paper: Array.from({ length: 8 }, (_, index) => ({
                title: `Results ${index}`,
                content: "Finding about figures and algorithms. ".repeat(2_000),
                subSections: [],
            })),
        };
        const context = selectPaperContext(
            oversized,
            "What does FIGURE 1 show?",
        );
        expect(context).toContain("FIGURE 1");
        expect(context).toContain("Consensual algorithm");
        expect(context.indexOf("FIGURE 1")).toBeLessThan(
            context.indexOf("## Abstract") === -1
                ? context.length
                : context.indexOf("## Abstract"),
        );
    });
});
