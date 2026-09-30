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
    quoteExcerpt: "The trial found a 12% reduction in events. Limitations include small n.",
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
        expect(parsed).toEqual({
            index: 1,
            title: paper.title,
            sourceLabel: paper.sourceLabel,
            authors: paper.authors,
            publicationDate: "2024",
            keyFindings: ["Finding A"],
            methods: "Double-blind RCT",
            limitations: ["Small sample"],
            openQuestions: ["Durability?"],
            evidenceType: "other",
            supportingExcerpt: paper.quoteExcerpt,
        });
    });

    it("keeps each finding's sentence only when it is word for word in the excerpt", () => {
        const parsed = parsePaperExtraction(
            {
                keyFindings: [
                    { finding: "Events fell", quote: "The trial found a 12% reduction in events." },
                    { finding: "Made up", quote: "The drug cured every patient in the trial." },
                ],
                methods: "",
            },
            paper,
        );
        expect(parsed?.keyFindings).toEqual(["Events fell", "Made up"]);
        expect(parsed?.evidence).toEqual([
            {
                id: "E1.1",
                finding: "Events fell",
                quote: "The trial found a 12% reduction in events.",
                anchor: expect.objectContaining({ length: 42 }),
            },
        ]);
    });

    it("stores only a fingerprint for a paper that can't be quoted", () => {
        const parsed = parsePaperExtraction(
            {
                keyFindings: [{ finding: "Events fell", quote: "The trial found a 12% reduction in events." }],
                methods: "",
            },
            { ...paper, quoteExcerpt: undefined },
        );
        expect(parsed?.evidence).toEqual([
            { id: "E1.1", finding: "Events fell", anchor: expect.objectContaining({ length: 42 }) },
        ]);
    });

    it("keeps the paper's methods sentence, not the summary, for Show method", () => {
        const parsed = parsePaperExtraction(
            {
                keyFindings: ["Events fell"],
                methods: "A randomized trial.",
                methodsQuote: "Limitations include small n.",
            },
            paper,
        );
        expect(parsed?.methods).toBe("A randomized trial.");
        expect(parsed?.methodsEvidence).toEqual({
            quote: "Limitations include small n.",
            anchor: expect.objectContaining({ length: 28 }),
        });
        const invented = parsePaperExtraction(
            { keyFindings: ["Events fell"], methods: "", methodsQuote: "Patients were randomized 1:1." },
            paper,
        );
        expect(invented?.methodsEvidence).toBeUndefined();
    });

    it("returns null for unrelated payloads", () => {
        expect(parsePaperExtraction(null, paper)).toBeNull();
        expect(parsePaperExtraction("nope", paper)).toBeNull();
    });
});

describe("fallbackPaperExtraction", () => {
    it("omits supportingExcerpt when the paper has no quotable body", () => {
        const fallback = fallbackPaperExtraction({
            ...paper,
            quoteExcerpt: undefined,
        });
        expect(fallback.supportingExcerpt).toBeUndefined();
        expect(fallback.keyFindings[0]).toContain("12% reduction");
    });

    it("keeps a short excerpt snippet as the only finding", () => {
        const fallback = fallbackPaperExtraction(paper);
        expect(fallback.evidenceType).toBe("other");
        expect(fallback.keyFindings[0]).toContain("12% reduction");
        expect(fallback.supportingExcerpt).toContain("12% reduction");
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
        expect(result.extraction.supportingExcerpt).toBe(paper.quoteExcerpt);
        expect(SUPPORTING_EXCERPT_CHAR_BUDGET).toBe(600);

        const [request] = createPrivateChatCompletion.mock.calls[0];
        expect(request.model).toBe("openai/gpt-4.1-mini");
        expect(request.messages[0].content).toContain(
            "untrusted quoted material",
        );
        expect(request.messages[1].content).toContain(
            JSON.stringify(paper.excerpt),
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
    describe("says why a paper fell back", () => {
        const reply = (content: string | null, finish_reason = "stop") => ({
            choices: [{ message: { content }, finish_reason }],
        });
        beforeEach(() => {
            vi.spyOn(console, "warn").mockImplementation(() => undefined);
        });

        it("a provider error", async () => {
            createPrivateChatCompletion.mockRejectedValue(
                Object.assign(new Error("Bad gateway"), { status: 502 }),
            );
            expect((await extractPaperFindings(paper)).failure).toEqual({
                reason: "provider_error",
                cutOff: false,
            });
        });

        it("a timeout", async () => {
            const error = new Error("Request timed out.");
            error.name = "APIConnectionTimeoutError";
            createPrivateChatCompletion.mockRejectedValue(error);
            expect((await extractPaperFindings(paper)).failure?.reason).toBe(
                "timeout",
            );
        });

        it("an empty reply", async () => {
            createPrivateChatCompletion.mockResolvedValue(reply(null));
            expect((await extractPaperFindings(paper)).failure?.reason).toBe(
                "empty_reply",
            );
        });

        it("a reply that isn't JSON, and whether it was cut off", async () => {
            createPrivateChatCompletion.mockResolvedValue(
                reply("I cannot help with that.", "length"),
            );
            expect((await extractPaperFindings(paper)).failure).toEqual({
                reason: "unreadable_reply",
                cutOff: true,
            });
        });

        it("JSON with no findings or methods", async () => {
            createPrivateChatCompletion.mockResolvedValue(
                reply(JSON.stringify({ keyFindings: [], limitations: [] })),
            );
            expect((await extractPaperFindings(paper)).failure?.reason).toBe(
                "no_findings",
            );
        });

        it("nothing, when the extraction works", async () => {
            createPrivateChatCompletion.mockResolvedValue(
                reply(
                    JSON.stringify({
                        keyFindings: [{ finding: "Events fell 12%", quote: "" }],
                        methods: "Trial",
                    }),
                ),
            );
            const result = await extractPaperFindings(paper);
            expect(result.usedFallback).toBe(false);
            expect(result.failure).toBeUndefined();
        });
    });
});
