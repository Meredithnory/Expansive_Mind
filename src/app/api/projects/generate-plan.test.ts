import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion } = vi.hoisted(() => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));

import {
    PLAN_MODEL,
    fallbackProjectPlan,
    generateProjectPlan,
    parseProjectPlan,
} from "./generate-plan";
import type { PaperExtraction } from "../discover/report-types";

const gap = {
    title: "Durability unknown",
    description: "No trial reports outcomes beyond 3 years.",
    whyItMatters: "Chronic use is the intended setting.",
    citations: [1, 2],
    confidence: "suggested" as const,
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

const validPlan = {
    steps: [
        { title: "Read the RCTs", description: "Deep-dive Papers 1–2.", paperRefs: [1, 2] },
        { title: "Note open questions", description: "List durability gaps.", paperRefs: [1] },
        { title: "Form a hypothesis", description: "Predict 5-year fade.", paperRefs: [2] },
        { title: "Sketch a validation study", description: "Extend follow-up.", paperRefs: [1] },
        { title: "Set 90-day milestones", description: "Protocol draft.", paperRefs: [1, 2] },
    ],
};

describe("parseProjectPlan", () => {
    it("reads structured steps and integer paper refs", () => {
        const parsed = parseProjectPlan({
            steps: [
                { title: " Read RCTs ", description: " Deep-dive ", paperRefs: [1, "2", 0] },
                { title: "Hypothesis", description: "Predict fade", paperRefs: [2] },
                { title: "Methods", description: "Extend follow-up", paperRefs: [] },
                { title: "Pilot", description: "Small n first", paperRefs: [1] },
                { title: "Milestones", description: "90 days", paperRefs: [1, 2] },
            ],
        });
        expect(parsed).toHaveLength(5);
        expect(parsed?.[0]).toEqual({
            title: "Read RCTs",
            description: "Deep-dive",
            paperRefs: [1, 2],
        });
    });

    it("returns null for unrelated or too-short payloads", () => {
        expect(parseProjectPlan(null)).toBeNull();
        expect(parseProjectPlan("nope")).toBeNull();
        expect(parseProjectPlan({ steps: [{ title: "Only one" }] })).toBeNull();
        expect(
            parseProjectPlan({
                steps: Array.from({ length: 10 }, (_, index) => ({
                    title: `Step ${index + 1}`,
                    description: "Too many",
                    paperRefs: [1],
                })),
            }),
        ).toBeNull();
    });
});

describe("fallbackProjectPlan", () => {
    it("returns a 5-step template that references the gap and citations", () => {
        const steps = fallbackProjectPlan(gap);
        expect(steps).toHaveLength(5);
        expect(steps[0].title).toContain("Durability unknown");
        expect(steps[0].paperRefs).toEqual([1, 2]);
        expect(steps[2].description).toContain("Chronic use");
        expect(steps.every((step) => step.title && step.description)).toBe(true);
    });
});

describe("generateProjectPlan", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
    });

    it("parses fenced JSON from the planning model", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: `\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``,
                    },
                },
            ],
        });

        const result = await generateProjectPlan(
            {
                question: "How durable is the effect?",
                gap,
                papers: [
                    {
                        index: 1,
                        title: "Example trial",
                        authors: ["A. Author"],
                        date: "2024",
                        sourceLabel: "Springer Nature",
                    },
                ],
                extractions: [extraction],
            },
            { feature: "projects", userID: "user-1" },
        );

        expect(result.usedFallback).toBe(false);
        expect(result.steps).toHaveLength(5);
        expect(result.steps[0].title).toBe("Read the RCTs");

        const [request] = createPrivateChatCompletion.mock.calls[0];
        expect(request.model).toBe(PLAN_MODEL);
        expect(request.max_tokens).toBe(2_000);
        expect(request.temperature).toBe(0.2);
        expect(request.messages[0].content).toContain("untrusted quoted material");
        expect(request.messages[1].content).toContain("Durability unknown");
        expect(request.messages[1].content).toContain("12% reduction");
    });

    it("retries once then falls back when JSON cannot be parsed", async () => {
        createPrivateChatCompletion
            .mockResolvedValueOnce({
                choices: [{ message: { content: "I cannot help with that." } }],
            })
            .mockResolvedValueOnce({
                choices: [{ message: { content: "still not json" } }],
            });

        const result = await generateProjectPlan({
            gap,
            papers: [],
        });

        expect(createPrivateChatCompletion).toHaveBeenCalledTimes(2);
        expect(result.usedFallback).toBe(true);
        expect(result.steps).toEqual(fallbackProjectPlan(gap));
    });

    it("falls back when the model call throws", async () => {
        createPrivateChatCompletion.mockRejectedValue(new Error("offline"));
        const result = await generateProjectPlan({ gap, papers: [] });
        expect(result.usedFallback).toBe(true);
        expect(result.steps[0].title).toContain(gap.title);
    });
});
