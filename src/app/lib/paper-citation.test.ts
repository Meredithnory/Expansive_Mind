import { describe, expect, it } from "vitest";
import type { FormattedPaper } from "../api/general-interfaces";
import {
    buildPaperLines,
    citationLabel,
    locateStatusLabel,
    encodeCitedMessage,
    locateExcerptInPaper,
    locateMethodInPaper,
    parseCitedMessage,
    wrapTextToLines,
} from "./paper-citation";

const paper = {
    title: "Example",
    authors: [],
    paperId: "1",
    idName: "pmcid",
    primarySource: "NIH",
    source: "nih",
    paper: [
        {
            title: "Abstract",
            content:
                "Glucagon-like peptide-1 receptor agonists are widely used for type 2 diabetes and obesity. Experimental support for reported associations with depression, anxiety, suicidality, reward-related behaviour, cognitive effects and retinal disturbances were assessed. A systematic literature review was conducted using PubMed.",
            figures: [],
            subSections: [],
        },
        {
            title: "Methods",
            content:
                "A systematic literature review was conducted using PubMed, Scopus, and Google Scholar. Mice were transfected with 2 µg plasmid using Lipofectamine. Readouts were taken at 48 hours.",
            figures: [],
            subSections: [],
        },
        {
            title: "Results",
            content:
                "The confidence interval excluded zero in the primary outcome.",
            figures: [],
            subSections: [],
        },
    ],
    access: {
        rawLicense: "CC BY",
        normalizedLicense: "CC-BY",
        licenseName: "CC BY",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        canonicalUrl: "https://example.test",
        attribution: {
            title: "Example",
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
} as FormattedPaper;

describe("paper citation lines", () => {
    it("wraps long paragraphs into editor-style lines", () => {
        expect(wrapTextToLines("one two three four", 8)).toEqual([
            "one two",
            "three",
            "four",
        ]);
    });

    it("locates a messy assistant quote inside the real abstract", () => {
        const citation = locateExcerptInPaper(
            paper,
            'The paper says: "Experimental support for reported associations with depression, anxiety"',
        );
        expect(citation.sectionTitle).toBe("Abstract");
        expect(citation.lines.join(" ")).toContain("Experimental support");
    });

    it("numbers wrapped paper lines and locates an excerpt range", () => {
        const lines = buildPaperLines(paper);
        expect(lines[0]?.sectionTitle).toBe("Abstract");
        expect(lines.length).toBeGreaterThan(3);
        const citation = locateExcerptInPaper(
            paper,
            "Experimental support for reported associations with depression, anxiety",
        );
        expect(citation.sectionTitle).toBe("Abstract");
        expect(citation.startLine).toBeGreaterThan(0);
        expect(citation.endLine).toBeGreaterThanOrEqual(citation.startLine);
        expect(citationLabel(citation)).toMatch(/Abstract · \d+/);
        expect(citation.lines.join(" ")).toContain("Experimental support");
    });

    it("prefers Methods over Abstract when the same methods sentence appears in both", () => {
        const citation = locateExcerptInPaper(
            paper,
            "A systematic literature review was conducted using PubMed",
            "Abstract",
        );
        expect(citation.sectionTitle).toBe("Methods");
        expect(locateStatusLabel(citation)).toBe("Highlighted in Methods");
    });

    it("does not announce Abstract in the locate chip", () => {
        const citation = locateExcerptInPaper(
            paper,
            "Experimental support for reported associations with depression, anxiety",
        );
        expect(citation.sectionTitle).toBe("Abstract");
        expect(locateStatusLabel(citation)).toBe("Highlighted this passage");
        expect(locateStatusLabel(citation)).not.toMatch(/Showing Abstract/i);
    });

    it("locates a method excerpt in the Methods section", () => {
        const citation = locateMethodInPaper(
            paper,
            "transfected with 2 µg plasmid using Lipofectamine",
        );
        expect(citation.sectionTitle).toBe("Methods");
        expect(citation.lines.join(" ")).toContain("Lipofectamine");
    });

    it("opens the Methods section when no excerpt is supplied", () => {
        const citation = locateMethodInPaper(paper);
        expect(citation.sectionTitle).toBe("Methods");
        expect(citation.lines.join(" ")).toMatch(/transfect|Mice/i);
    });
});

describe("citation message encoding", () => {
    it("round-trips a boxed line-range reference and the user question", () => {
        const encoded = encodeCitedMessage(
            [
                {
                    sectionTitle: "Abstract",
                    startLine: 28,
                    endLine: 34,
                    lines: [
                        "experimental support for reported",
                        "associations with depression",
                    ],
                },
            ],
            "What does this mean?",
        );
        expect(encoded).toContain(":::cite|Abstract|28|34");
        const parsed = parseCitedMessage(encoded);
        expect(parsed.citations).toEqual([
            {
                sectionTitle: "Abstract",
                startLine: 28,
                endLine: 34,
                lines: [
                    "experimental support for reported",
                    "associations with depression",
                ],
            },
        ]);
        expect(parsed.question).toBe("What does this mean?");
        expect(citationLabel(parsed.citations[0])).toBe("Abstract · 28–34");
    });

    it("parses an assistant cite with 1|1 and a quote on the next lines", () => {
        const parsed = parseCitedMessage(
            [
                ":::cite|Abstract|1|1",
                "A systematic literature review was conducted.",
                ":::",
                "The key method is described in the Abstract.",
            ].join("\n"),
        );
        expect(parsed.citations).toEqual([
            {
                sectionTitle: "Abstract",
                startLine: 1,
                endLine: 1,
                lines: ["A systematic literature review was conducted."],
            },
        ]);
        expect(parsed.question).toBe(
            "The key method is described in the Abstract.",
        );
    });

    it("parses a messy model cite with a 4-9 range and an inline quote", () => {
        const parsed = parseCitedMessage(
            ':::cite|Abstract|1|4-9 "A systematic literature review was conducted across PubMed."\nThe key method is a systematic review.',
        );
        expect(parsed.citations[0]).toMatchObject({
            sectionTitle: "Abstract",
            startLine: 1,
            endLine: 9,
            lines: [
                "A systematic literature review was conducted across PubMed.",
            ],
        });
        expect(parsed.question).toBe("The key method is a systematic review.");
    });

    it("keeps prose before a cite and does not leave raw :::cite markup", () => {
        const parsed = parseCitedMessage(
            [
                "Here is the method.",
                ":::cite|Methods|2|3",
                "Mice were transfected with 2 µg plasmid.",
                ":::",
            ].join("\n"),
        );
        expect(parsed.question).toBe("Here is the method.");
        expect(parsed.citations[0]?.sectionTitle).toBe("Methods");
        expect(parsed.question).not.toMatch(/:::cite/);
    });
});
