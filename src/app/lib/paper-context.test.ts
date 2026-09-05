import { describe, expect, it } from "vitest";
import type { FormattedPaper } from "../api/general-interfaces";
import { selectPaperContext, selectQuotableExcerpt } from "./paper-context";

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
        expect(context).toContain("## Abstract");
        expect(context).toContain("## Results");
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

    it("selects a body-only quote and ignores abstract-only papers", () => {
        const quote = selectQuotableExcerpt(
            paper,
            "Did treatment reduce inflammation?",
        );
        expect(quote).toContain("## Results");
        expect(quote).not.toContain("## Abstract");
        expect(
            selectQuotableExcerpt(
                {
                    ...paper,
                    paper: [
                        {
                            title: "Abstract",
                            content: "The treatment reduced inflammation.",
                            subSections: [],
                        },
                    ],
                },
                "Did treatment reduce inflammation?",
            ),
        ).toBe("");
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
});
