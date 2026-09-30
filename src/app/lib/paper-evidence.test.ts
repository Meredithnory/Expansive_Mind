import { describe, expect, it } from "vitest";
import {
    citedEvidenceQuote,
    closestSentence,
    evidenceAnchor,
    evidenceFocusHref,
    evidencePassage,
    findAnchoredSentence,
    gapEvidenceId,
    matchVerbatim,
    methodFocusHref,
    paperSearchText,
    parseAnchorParam,
    verifiedPaperEvidence,
    verifiedSentence,
} from "./paper-evidence";

const excerpt =
    "## Results\nUnder repeated low-density antigen stimulation, conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.  NKG2D/CD28 co-expression preserved killing through day 21 — a 3-fold improvement.";

describe("matchVerbatim", () => {
    it("finds the quote as the paper wrote it, despite spacing, quotes, and dashes", () => {
        expect(
            matchVerbatim(
                excerpt,
                "conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.",
            ),
        ).toBe("conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.");
        expect(
            matchVerbatim(excerpt, "NKG2D/CD28 co-expression preserved killing through day 21 - a 3-fold improvement..."),
        ).toBe("NKG2D/CD28 co-expression preserved killing through day 21 — a 3-fold improvement");
    });

    it("rejects a paraphrase and a fragment too short to point anywhere", () => {
        expect(matchVerbatim(excerpt, "CAR-T cells became exhausted after two weeks of stimulation.")).toBeNull();
        expect(matchVerbatim(excerpt, "day 14")).toBeNull();
    });
});

describe("verifiedPaperEvidence", () => {
    const items = [
        { finding: "Chronic low antigen exhausts CAR-T cells", quote: "conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3." },
        { finding: "Invented", quote: "This sentence is not in the paper at all, anywhere." },
        { finding: "Co-stimulation extends killing", quote: "NKG2D/CD28 co-expression preserved killing through day 21" },
    ];

    it("keeps only quotes found in the excerpt and numbers them per paper", () => {
        const evidence = verifiedPaperEvidence({ paperIndex: 3, excerpt, quotable: true, items });
        expect(evidence.map((item) => item.id)).toEqual(["E3.1", "E3.2"]);
        expect(evidence[1].finding).toBe("Co-stimulation extends killing");
        expect(evidence[1].quote).toBe("NKG2D/CD28 co-expression preserved killing through day 21");
        expect(evidence[1].anchor).toEqual(
            evidenceAnchor("NKG2D/CD28 co-expression preserved killing through day 21"),
        );
    });

    it("keeps only a fingerprint, no paper text, when the license blocks quoting", () => {
        const evidence = verifiedPaperEvidence({ paperIndex: 3, excerpt, quotable: false, items });
        expect(evidence.map((item) => item.id)).toEqual(["E3.1", "E3.2"]);
        for (const item of evidence) {
            expect(item.quote).toBeUndefined();
            expect(item.anchor?.hash).toMatch(/^[0-9a-f]+$/);
            expect(JSON.stringify(item)).not.toContain("cytotoxicity");
        }
    });
});

describe("citedEvidenceQuote", () => {
    const evidence = [
        { id: "E1.1", finding: "Chronic antigen exposure drives T cell exhaustion", quote: "Repeated stimulation raised PD-1 and TIM-3 on CAR-T cells." },
        { id: "E1.2", finding: "Dual targeting improves persistence", quote: "NKG2D/CD28 CAR-T cells persisted longer in low-antigen tumors." },
        { id: "E2.1", finding: "Other paper", quote: "Something from paper two, not paper one." },
    ];

    it("uses the evidence the report cited", () => {
        expect(citedEvidenceQuote(evidence, 1, { evidenceId: "E1.2" })).toBe(
            "NKG2D/CD28 CAR-T cells persisted longer in low-antigen tumors.",
        );
    });

    it("otherwise matches the chip's sentence to that paper's evidence", () => {
        expect(
            citedEvidenceQuote(evidence, 1, {
                context: "chronic antigen exposure drives T cell exhaustion and differentiation",
            }),
        ).toBe("Repeated stimulation raised PD-1 and TIM-3 on CAR-T cells.");
    });

    it("returns nothing rather than a weak guess or another paper's evidence", () => {
        expect(citedEvidenceQuote(evidence, 1, { context: "Clinical response rates were poor" })).toBeNull();
        expect(citedEvidenceQuote(evidence, 1, { evidenceId: "E2.1" })).toBeNull();
        expect(citedEvidenceQuote(undefined, 1, { evidenceId: "E1.1" })).toBeNull();
    });
});

describe("gapEvidenceId", () => {
    it("finds the gap's cited evidence for a paper", () => {
        const map = { "gaps.1.description": [null, "E4.2"], "gaps.1.whyItMatters": ["E6.1"] };
        expect(gapEvidenceId(map, 1, 4)).toBe("E4.2");
        expect(gapEvidenceId(map, 1, 6)).toBe("E6.1");
        expect(gapEvidenceId(map, 0, 4)).toBeNull();
    });
});

describe("sentence fingerprints", () => {
    const sentence = "Conventional CAR-T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.";

    it("finds the sentence again in the paper as the reader shows it", () => {
        const anchor = evidenceAnchor(sentence);
        const shown =
            "Results\nUnder repeated stimulation,   conventional CAR\u2011T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3. Other text follows.";
        expect(findAnchoredSentence(shown, anchor)).toBe(
            "conventional CAR\u2011T cells lost cytotoxicity by day 14 and expressed PD-1 and TIM-3.",
        );
    });

    it("finds nothing when the paper no longer has the sentence", () => {
        expect(findAnchoredSentence("A different paper entirely, about kinases.", evidenceAnchor(sentence))).toBeNull();
    });

    it("searches the abstract and every section and subsection", () => {
        const text = paperSearchText({
            abstract: "Abstract text.",
            paper: [{ content: "Intro.", subSections: [{ content: sentence }] }],
        });
        expect(findAnchoredSentence(text, evidenceAnchor(sentence))).toBe(sentence);
    });

    it("prefers the stored sentence, else looks the anchor up", () => {
        const anchor = evidenceAnchor(sentence);
        expect(evidencePassage({ quote: "Stored.", anchor }, "")).toBe("Stored.");
        expect(evidencePassage({ anchor }, `Before. ${sentence} After.`)).toBe(sentence);
        expect(evidencePassage(null, sentence)).toBeNull();
    });
});

describe("evidence links", () => {
    it("opens at the sentence text when we keep it, else at its fingerprint", () => {
        const anchor = { hash: "1a2b3c", length: 80 };
        expect(evidenceFocusHref("/paperchatbot/nih/123", { quote: "Events fell by 12%.", anchor })).toContain(
            "focus=Events+fell+by+12%25.",
        );
        const href = evidenceFocusHref("/paperchatbot/nih/123?from=report", { anchor });
        expect(href).toBe("/paperchatbot/nih/123?from=report&anchor=1a2b3c.80");
        expect(parseAnchorParam("1a2b3c.80")).toEqual(anchor);
        expect(parseAnchorParam("1a2b3c.5")).toBeNull();
        expect(parseAnchorParam("<script>.80")).toBeNull();
    });
});

describe("Show method", () => {
    it("opens at the paper's own methods sentence when one was verified", () => {
        const anchor = { hash: "abc123", length: 60 };
        expect(methodFocusHref("/paperchatbot/nih/1", { quote: "Mice were dosed daily for 21 days.", anchor })).toBe(
            "/paperchatbot/nih/1?focus=Mice+were+dosed+daily+for+21+days.&intent=method",
        );
        expect(methodFocusHref("/paperchatbot/nih/1", { anchor })).toBe(
            "/paperchatbot/nih/1?intent=method&anchor=abc123.60",
        );
    });

    it("otherwise opens the Methods section, never a paraphrase", () => {
        expect(methodFocusHref("/paperchatbot/nih/1", undefined)).toBe("/paperchatbot/nih/1?intent=method");
    });

    it("keeps a methods sentence only when it is word for word in the excerpt", () => {
        const text = "## Methods\nMice were dosed daily for 21 days with the study drug. Results follow.";
        expect(verifiedSentence({ excerpt: text, quotable: true, quote: "Mice were dosed daily for 21 days with the study drug." })?.quote).toBe(
            "Mice were dosed daily for 21 days with the study drug.",
        );
        expect(verifiedSentence({ excerpt: text, quotable: false, quote: "Mice were dosed daily for 21 days with the study drug." })?.quote).toBeUndefined();
        expect(verifiedSentence({ excerpt: text, quotable: true, quote: "A randomized trial of the study drug in mice." })).toBeNull();
    });
});

describe("closestSentence", () => {
    const paper = {
        abstract:
            "Base editing is a genome editing strategy that induces single nucleotide changes. It has been used widely for precise genome editing.",
        paper: [
            {
                title: "Results",
                content:
                    "Cells were cultured for 48 hours before sequencing. Whole-genome sequencing revealed that cytosine base editors induced substantial off-target edits in DNA, while adenine base editors did not.\nRNA off-target editing was also detected for both editor classes.",
                subSections: [],
            },
            {
                title: "References",
                content:
                    "Off-target editing by CRISPR-guided DNA base editors and off-target RNA edits of adenine base editors. Biochemistry 2019.",
                subSections: [],
            },
        ],
    };

    it("finds the paper's sentence that best matches the claim", () => {
        expect(
            closestSentence(
                paper,
                "Cytosine base editors cause off-target DNA edits that adenine editors avoid",
            ),
        ).toBe(
            "Whole-genome sequencing revealed that cytosine base editors induced substantial off-target edits in DNA, while adenine base editors did not.",
        );
    });

    it("matches across hyphenation and prefers the claim's rare words", () => {
        const review = {
            paper: [
                {
                    title: "Introduction",
                    content:
                        "However, off-target editing by DNA base editors has been observed in many studies. More recent reports suggest that promiscuous deaminase domains in base editors can lead to guide RNA-independent off target editing in DNA and RNA. Base editors are widely used.",
                    subSections: [],
                },
            ],
        };
        expect(
            closestSentence(
                review,
                "Genotoxicity checks miss guide-independent base editor off-target edits",
            ),
        ).toContain("guide RNA-independent");
    });

    it("never picks a reference-list entry", () => {
        const match = closestSentence(
            paper,
            "Off-target RNA edits by CRISPR-guided adenine base editors",
        );
        expect(match).not.toContain("Biochemistry");
    });

    it("returns null when nothing clearly matches", () => {
        expect(closestSentence(paper, "Insulin dosing in pediatric type 1 diabetes")).toBeNull();
        expect(closestSentence(paper, "editing")).toBeNull();
    });
});
