import { describe, expect, it } from "vitest";
import type { FormattedPaper } from "../api/general-interfaces";
import { findCitedSourceInPaper } from "./cite-source-focus";

const paper = (sections: FormattedPaper["paper"]): FormattedPaper =>
    ({
        title: "Citing paper",
        authors: ["B. Author"],
        paperId: "1",
        idName: "pmcid",
        primarySource: "NIH",
        paper: sections,
        access: {
            rawLicense: null,
            normalizedLicense: "UNKNOWN",
            licenseName: null,
            licenseUrl: null,
            canonicalUrl: "https://example.com",
            attribution: {
                title: "Citing paper",
                authors: ["B. Author"],
                sourceLabel: "NIH",
                canonicalUrl: "https://example.com",
                paperId: "1",
                idName: "pmcid",
            },
            policyReason: "test",
            policyReasonCode: "license_unknown",
            canDisplayFullText: true,
            canSendToAI: true,
            canPersistContent: false,
        },
    }) as FormattedPaper;

describe("findCitedSourceInPaper", () => {
    it("matches a DOI in the references section", () => {
        const citation = findCitedSourceInPaper(
            paper([
                {
                    title: "Introduction",
                    content: "Prior work is reviewed elsewhere.",
                    subSections: [],
                },
                {
                    title: "References",
                    content:
                        "1. Pandya AG. Disorders of hyperpigmentation. J Dermatol. doi:10.1234/example-paper.",
                    subSections: [],
                },
            ]),
            {
                title: "Disorders of hyperpigmentation",
                doi: "10.1234/example-paper",
                authors: ["AG Pandya"],
                year: 1999,
            },
        );
        expect(citation).not.toBeNull();
        expect(citation?.sectionTitle.toLowerCase()).toContain("reference");
        expect(citation?.lines.join(" ").toLowerCase()).toContain(
            "10.1234/example-paper",
        );
    });

    it("returns null when the source is not mentioned", () => {
        const citation = findCitedSourceInPaper(
            paper([
                {
                    title: "Discussion",
                    content: "No external references are discussed here.",
                    subSections: [],
                },
            ]),
            {
                title: "Disorders of hyperpigmentation",
                doi: "10.9999/missing",
                authors: ["AG Pandya"],
                year: 1999,
            },
        );
        expect(citation).toBeNull();
    });
});
