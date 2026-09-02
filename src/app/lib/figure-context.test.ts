import { describe, expect, it } from "vitest";
import type { FormattedPaper, PaperFigure } from "../api/general-interfaces";
import { buildFigureContext, findPaperFigure } from "./figure-context";

const figure: PaperFigure = {
    id: "fig-2",
    label: "Figure 2",
    captionTitle: "Treatment response",
    caption: "Points are means and bars are confidence intervals.",
    sourceImageRef: "fig2.png",
    imageUrl: "https://cdn.ncbi.nlm.nih.gov/fig2.png",
    sectionTitle: "Results",
    subSectionTitle: "Primary outcome",
    hasSeparateRights: true,
    canAnalyzeSourceImage: true,
};

const paper: FormattedPaper = {
    title: "Example study",
    authors: [],
    paperId: "1",
    idName: "pmcid",
    primarySource: "NIH",
    source: "nih",
    figures: [figure],
    paper: [
        {
            title: "Results",
            content: "The treatment group improved compared with control.",
            figures: [],
            subSections: [
                {
                    title: "Primary outcome",
                    content: "The confidence interval excluded zero.",
                    figures: [figure],
                },
            ],
        },
    ],
    access: {
        rawLicense: "CC BY 4.0",
        normalizedLicense: "CC-BY",
        licenseName: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        canonicalUrl: "https://example.test",
        attribution: {
            title: "Example study",
            authors: [],
            sourceLabel: "NIH",
            canonicalUrl: "https://example.test",
            paperId: "1",
            idName: "pmcid",
        },
        policyReason: "Allowed",
        policyReasonCode: "allowed_cc_by",
        canDisplayFullText: true,
        canSendToAI: true,
        canPersistContent: true,
        canUseImages: true,
    },
};

describe("figure context", () => {
    it("finds stable figure references and includes nearby evidence", () => {
        expect(findPaperFigure(paper, "fig-2")).toEqual(figure);
        const context = buildFigureContext(paper, figure);
        expect(context).toContain("Figure: Figure 2");
        expect(context).toContain("bars are confidence intervals");
        expect(context).toContain("treatment group improved");
        expect(context).toContain("excluded zero");
    });

    it("uses only user-supplied captions for uploaded images", () => {
        const context = buildFigureContext(
            paper,
            null,
            "Screenshot caption supplied by the user.",
        );
        expect(context).toContain(
            "Selected excerpt or caption: Screenshot caption supplied by the user.",
        );
        expect(context).not.toContain("treatment group improved");
    });
});
