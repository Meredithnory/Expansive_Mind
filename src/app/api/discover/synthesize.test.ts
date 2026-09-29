import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion } = vi.hoisted(() => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));

import {
    attachCitationEvidence,
    parseOpportunityReport,
    renderOpportunityReport,
    synthesizeOpportunityReport,
    REPORT_DISCLAIMER,
} from "./synthesize";
import { parseJsonFromLlm } from "./parse-llm-json";
import type { OpportunityReport, PaperExtraction } from "./report-types";

const report: OpportunityReport = {
    sections: {
        stateOfScience:
            "GLP-1 agonists reduce major events in high-risk adults [Paper 1].",
        gaps: [
            {
                title: "Durability unknown",
                description: "No trial reports outcomes beyond 3 years.",
                whyItMatters: "Chronic use is the intended setting.",
                citations: [1, 2],
                confidence: "suggested",
            },
        ],
        problems: [
            {
                title: "Need a durability biomarker",
                description: "A validated marker would de-risk longer trials.",
                gapRefs: [1],
            },
        ],
        venturePotential: [
            {
                title: "Durability assay company",
                thesis: "A lab test predicting loss of response could be licensed.",
                feasibilitySignals: "Assay methods are described in Paper 2.",
                risks: "Reimbursement and clinical adoption are unproven.",
                citations: [2],
            },
        ],
        couldNotVerify: [
            "Full protocols were not in the licensed excerpts.",
        ],
        projectSeeds: [
            {
                title: "Meta-analyze durability endpoints",
                oneLiner: "Pool time-to-loss-of-response across the cited RCTs.",
                gapRef: 1,
            },
        ],
    },
};

const extraction: PaperExtraction = {
    index: 1,
    title: "Example trial",
    sourceLabel: "Springer Nature",
    authors: ["A. Author"],
    publicationDate: "2024",
    keyFindings: ["12% reduction"],
    methods: "RCT",
    limitations: ["Small n"],
    openQuestions: ["Durability?"],
    evidenceType: "rct",
};

describe("parseJsonFromLlm", () => {
    it("strips fenced JSON and recovers an embedded object", () => {
        expect(
            parseJsonFromLlm('```json\n{"queries":["a"]}\n```'),
        ).toEqual({ queries: ["a"] });
        expect(
            parseJsonFromLlm('Here you go:\n{"stateOfScience":"ok"}\nThanks'),
        ).toEqual({ stateOfScience: "ok" });
        expect(parseJsonFromLlm("not json")).toBeNull();
        expect(
            parseJsonFromLlm(JSON.stringify(JSON.stringify({ queries: ["a"] }))),
        ).toEqual({ queries: ["a"] });
    });

    it("repairs a truncated opportunity-report JSON object", () => {
        const truncated = `{"sections": {"stateOfScience": "Bone marrow tissue engineering is active.", "gaps": [{"title": "Lack of integrated niches", "description": "Scaffolds are siloed.", "whyItMatters": "Therapy needs a full niche.", "citations": [2, 4], "confidence": "established"}, {"title": "Incomplete signaling"`;
        const parsed = parseJsonFromLlm(truncated) as {
            sections: { stateOfScience: string; gaps: Array<{ title: string }> };
        };
        expect(parsed.sections.stateOfScience).toContain("Bone marrow");
        expect(parsed.sections.gaps[0].title).toBe("Lack of integrated niches");
    });
});

describe("parseOpportunityReport", () => {
    it("accepts nested sections and coerces citations", () => {
        const parsed = parseOpportunityReport({
            sections: {
                stateOfScience: "A cited answer.",
                gaps: [
                    {
                        title: "Gap",
                        description: "Missing data.",
                        whyItMatters: "It matters.",
                        citations: ["1", 2],
                        confidence: "established",
                    },
                    { title: "" },
                ],
                problems: [{ title: "Problem", description: "Solve it.", gapRefs: [1] }],
                venturePotential: [
                    {
                        title: "Venture",
                        thesis: "A thesis.",
                        feasibilitySignals: "Signals",
                        risks: "Risks",
                        citations: [1],
                    },
                ],
                couldNotVerify: ["Limit"],
                projectSeeds: [
                    { title: "Seed", oneLiner: "Do the work", gapRef: 1 },
                ],
            },
        });
        expect(parsed?.sections.gaps[0].citations).toEqual([1, 2]);
        expect(parsed?.sections.gaps[0].confidence).toBe("established");
        expect(parsed?.sections.projectSeeds[0].gapRef).toBe(1);
    });

    it("accepts a flat object and defaults invalid confidence", () => {
        const parsed = parseOpportunityReport({
            stateOfScience: "Flat answer.",
            gaps: [
                {
                    title: "Gap",
                    description: "Missing.",
                    citations: [1],
                    confidence: "wild",
                },
            ],
        });
        expect(parsed?.sections.stateOfScience).toBe("Flat answer.");
        expect(parsed?.sections.gaps[0].confidence).toBe("suggested");
    });

    it("keeps sanitized registry terms on gaps", () => {
        const parsed = parseOpportunityReport({
            gaps: [
                {
                    title: "Gap",
                    registryTerms: [["Senolytics", "alzheimer"], "junk", ["dasatinib", "quercetin"]],
                },
                { title: "No terms" },
            ],
        });
        expect(parsed?.sections.gaps[0].registryTerms).toEqual([
            ["senolytics", "alzheimer"],
            ["dasatinib", "quercetin"],
        ]);
        expect(parsed?.sections.gaps[1]).not.toHaveProperty("registryTerms");
    });

    it("returns null when the payload has no usable sections", () => {
        expect(parseOpportunityReport({})).toBeNull();
        expect(parseOpportunityReport(null)).toBeNull();
    });

    it("parses a raw JSON string the same way as an object", () => {
        const parsed = parseOpportunityReport(JSON.stringify(report));
        expect(parsed?.sections.gaps[0].title).toBe("Durability unknown");
    });
});

describe("renderOpportunityReport", () => {
    it("renders the fixed markdown sections with Paper N citations", () => {
        const markdown = renderOpportunityReport(report);
        expect(markdown).toContain("## State of the science");
        expect(markdown).toContain("## Gaps in the science");
        expect(markdown).toContain("## Problems these gaps could solve");
        expect(markdown).toContain("## Next experiments");
        expect(markdown).toContain("## Translation notes");
        expect(markdown).toContain("## What we could not verify");
        expect(markdown.indexOf("## Translation notes")).toBeLessThan(
            markdown.indexOf("## What we could not verify"),
        );
        expect(markdown.indexOf("## What we could not verify")).toBeLessThan(
            markdown.indexOf("## Next experiments"),
        );
        expect(markdown).toContain("[Paper 1]");
        expect(markdown).toContain("[Paper 2]");
        expect(markdown).toContain("Confidence: suggested");
        expect(markdown).toContain(REPORT_DISCLAIMER);
        expect(markdown).not.toMatch(/^## Direct answer/m);
    });
});

describe("synthesizeOpportunityReport", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
    });

    it("parses JSON and returns rendered markdown plus the structured report", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify(report),
                    },
                },
            ],
        });

        const result = await synthesizeOpportunityReport(
            "How durable is GLP-1 benefit?",
            [extraction],
            { feature: "discover", userID: "user-1" },
        );

        expect(result?.report).toEqual(report);
        expect(result?.brief).toContain("## State of the science");
        expect(result?.brief).toContain("[Paper 1]");
        const [request] = createPrivateChatCompletion.mock.calls[0];
        expect(request.model).toBe("anthropic/claude-sonnet-4.5");
        expect(request.max_tokens).toBe(5_000);
        expect(request.temperature).toBe(0.2);
        expect(request.messages[0].content).toContain(
            "untrusted quoted material",
        );
    });

    it("gives the writer each paper's population and tells it to keep numbers in scope", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(report) } }],
        });

        await synthesizeOpportunityReport(
            "How often are off-target edits assessed?",
            [{ ...extraction, population: "genome-edited livestock" }],
        );

        const [request] = createPrivateChatCompletion.mock.calls[0];
        expect(request.messages[0].content).toContain(
            "A number, percentage, or count keeps the scope it was measured in.",
        );
        expect(request.messages[1].content).toContain(
            '"population":"genome-edited livestock"',
        );
    });

    it("retries once when the first reply is not valid JSON", async () => {
        createPrivateChatCompletion
            .mockResolvedValueOnce({
                choices: [{ message: { content: "Let me think about this." } }],
            })
            .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify(report) } }],
            });

        const result = await synthesizeOpportunityReport("q", [extraction]);
        expect(createPrivateChatCompletion).toHaveBeenCalledTimes(2);
        expect(result?.report?.sections.gaps).toHaveLength(1);
        expect(result?.brief).toContain("## Next experiments");
        const retryMessages =
            createPrivateChatCompletion.mock.calls[1][0].messages;
        expect(retryMessages.at(-1).content).toContain(
            "Return only valid JSON",
        );
    });

    it("falls back to raw model text when JSON still cannot be parsed", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [{ message: { content: "## Direct answer\nNot JSON." } }],
        });

        const result = await synthesizeOpportunityReport("q", [extraction]);
        expect(result?.report).toBeUndefined();
        expect(result?.brief).toBe("## Direct answer\nNot JSON.");
        expect(createPrivateChatCompletion).toHaveBeenCalledTimes(2);
    });

    it("falls back to gpt-4.1-mini when Sonnet times out", async () => {
        createPrivateChatCompletion
            .mockRejectedValueOnce(new Error("Request timed out."))
            .mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify(report) } }],
            });

        const result = await synthesizeOpportunityReport("q", [extraction]);
        expect(result?.report?.sections.gaps).toHaveLength(1);
        expect(createPrivateChatCompletion.mock.calls[0][0].model).toBe(
            "anthropic/claude-sonnet-4.5",
        );
        expect(createPrivateChatCompletion.mock.calls[1][0].model).toBe(
            "openai/gpt-4.1-mini",
        );
        expect(createPrivateChatCompletion.mock.calls[0][2]).toEqual({
            timeoutMs: 90_000,
        });
    });
});

describe("attachCitationEvidence", () => {
    const extraction = (index: number, ids: string[]): PaperExtraction => ({
        index,
        title: `Paper ${index}`,
        sourceLabel: "Springer Nature",
        authors: [],
        keyFindings: [],
        methods: "",
        limitations: [],
        openQuestions: [],
        evidenceType: "other",
        evidence: ids.map((id) => ({ id, finding: "f", quote: "q" })),
    });

    it("turns evidence ids into plain citations and remembers them per chip", () => {
        const cited = attachCitationEvidence(
            {
                sections: {
                    stateOfScience: "Cells fail to persist [E2.1] and exhaust [E1.1, Paper 3].",
                    gaps: [
                        {
                            title: "Gap",
                            description: "Persistence beyond two weeks is untested [E2.1].",
                            whyItMatters: "",
                            citations: [1],
                            confidence: "suggested",
                        },
                    ],
                    problems: [],
                    venturePotential: [],
                    couldNotVerify: ["No dose data [E9.9]."],
                    projectSeeds: [],
                },
            },
            [extraction(1, ["E1.1"]), extraction(2, ["E2.1"]), extraction(3, [])],
        );
        const { sections } = cited;
        expect(sections.stateOfScience).toBe(
            "Cells fail to persist [Paper 2] and exhaust [Papers 1, 3].",
        );
        expect(sections.gaps[0].description).toBe(
            "Persistence beyond two weeks is untested [Paper 2].",
        );
        // Paper 2 is cited by evidence, so the gap lists it.
        expect(sections.gaps[0].citations).toEqual([1, 2]);
        // An id for a paper outside the report is dropped from the text.
        expect(sections.couldNotVerify[0]).toBe("No dose data.");
        expect(sections.citationEvidence).toEqual({
            stateOfScience: ["E2.1", "E1.1", null],
            "gaps.0.description": ["E2.1"],
        });
        expect(renderOpportunityReport(cited)).not.toMatch(/\[E\d/);
    });
});
