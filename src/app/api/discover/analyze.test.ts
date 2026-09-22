import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion } = vi.hoisted(() => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));

import {
    extractPaperFindings,
    fallbackPaperExtraction,
    parsePaperExtraction,
    PAPER_EXCERPT_CHAR_BUDGET,
    SUPPORTING_EXCERPT_CHAR_BUDGET,
} from "./analyze";
import type { PaperExcerptForSynthesis } from "./report-types";

const paper: PaperExcerptForSynthesis = {
    index: 1,
    title: "Example trial",
    sourceLabel: "Springer Nature",
    authors: ["A. Author"],
    publicationDate: "2024",
    excerpt: "The trial found a 12% reduction in events. Limitations include small n.",
};

describe("parsePaperExtraction", () => {
    it("reads structured fields and defaults unknown evidence types", () => {
        const parsed = parsePaperExtraction(
            {
                keyFindings: ["Finding A", " ", 12],
                methods: " Double-blind RCT ",
                limitations: ["Small sample"],
                openQuestions: ["Durability?"],
                evidenceType: "not-a-type",
            },
            paper,
        );
        expect(parsed?.evidenceType).toBe("rct");
        expect(parsed?.studyDesign).toBe("rct");
        expect(parsed?.keyFindings).toEqual(["Finding A"]);
        expect(parsed?.methods).toBe("Double-blind RCT");
        expect(parsed?.supportingExcerpt).toBeUndefined();
        expect(parsed?.claims?.[0]).toMatchObject({
            claimText: "Finding A",
            paperId: "paper-1",
            supportRelation: "unverified",
            verificationStatus: "not_checked",
        });
    });

    it("returns null for unrelated payloads", () => {
        expect(parsePaperExtraction(null, paper)).toBeNull();
        expect(parsePaperExtraction("nope", paper)).toBeNull();
    });
});

describe("fallbackPaperExtraction", () => {
    it("keeps a short excerpt snippet as the only finding", () => {
        const fallback = fallbackPaperExtraction(paper);
        expect(fallback.evidenceType).toBe("other");
        expect(fallback.keyFindings[0]).toContain("12% reduction");
        expect(fallback.supportingExcerpt).toBeUndefined();
        expect(fallback.claims?.[0].supportRelation).toBe("unverified");
        expect(fallback.methods).toBe("");
    });
});

describe("extractPaperFindings", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
    });

    it("parses fenced JSON from the cheap model", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: `\`\`\`json
{"keyFindings":["12% reduction"],"methods":"RCT","limitations":["small n"],"openQuestions":[],"evidenceType":"rct"}
\`\`\``,
                    },
                },
            ],
        });

        const result = await extractPaperFindings(paper, {
            feature: "discover",
            userID: "user-1",
        });
        expect(result.usedFallback).toBe(false);
        expect(result.extraction.evidenceType).toBe("rct");
        expect(result.extraction.keyFindings).toEqual(["12% reduction"]);
        expect(result.extraction.supportingExcerpt).toBeUndefined();
        expect(result.extraction.claims?.[0].supportRelation).toBe("unverified");
        expect(SUPPORTING_EXCERPT_CHAR_BUDGET).toBe(600);

        const [request] = createPrivateChatCompletion.mock.calls[0];
        expect(request.model).toBe("openai/gpt-4.1-mini");
        expect(request.messages[0].content).toContain(
            "untrusted quoted material",
        );
        expect(request.messages[0].content).toContain("findingQuotes");
        expect(request.messages[0].content).toContain(
            "Do not reuse the opening sentence",
        );
        expect(request.messages[1].content).toContain(
            `"""${paper.excerpt}"""`,
        );
        expect(PAPER_EXCERPT_CHAR_BUDGET).toBe(3_000);
    });

    it("falls back to a minimal extraction when JSON cannot be parsed", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [{ message: { content: "I cannot help with that." } }],
        });
        const result = await extractPaperFindings(paper);
        expect(result.usedFallback).toBe(true);
        expect(result.extraction.keyFindings.length).toBeGreaterThan(0);
        expect(result.extraction.evidenceType).toBe("other");
    });

    it("falls back when the model call throws", async () => {
        createPrivateChatCompletion.mockRejectedValue(new Error("offline"));
        const result = await extractPaperFindings(paper);
        expect(result.usedFallback).toBe(true);
        expect(result.extraction.title).toBe(paper.title);
    });
});
