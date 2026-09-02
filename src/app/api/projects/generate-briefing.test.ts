import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPrivateChatCompletion } = vi.hoisted(() => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion }));

import {
    BRIEFING_MODEL,
    fallbackProjectBriefing,
    generateProjectBriefing,
    parseProjectBriefing,
} from "./generate-briefing";
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
    methods: "Double-blind RCT, n=210",
    limitations: ["Small n"],
    openQuestions: ["Durability past year 3?"],
    evidenceType: "rct",
    supportingExcerpt: "Events fell 12% versus placebo.",
};

const validBriefing = {
    alreadyTried: [
        {
            paperIndex: 1,
            method: "Double-blind RCT, n=210",
            finding: "12% reduction at 2 years",
        },
    ],
    stillOpen: ["No outcome past 3 years"],
    nextMove: {
        title: "Extend follow-up in the same cohort",
        model: "Existing RCT cohort",
        comparison: "Year 5 vs year 2 response",
        readout: "Time to loss of response",
        paperRefs: [1],
    },
    couldNotVerify: ["Protocols were not in the excerpts."],
};

describe("parseProjectBriefing", () => {
    it("reads tried methods, open questions, and the next move", () => {
        const parsed = parseProjectBriefing({
            alreadyTried: [
                {
                    paperIndex: "1",
                    method: " RCT ",
                    finding: " 12% ",
                },
            ],
            stillOpen: ["Durability"],
            nextMove: {
                title: " Extend follow-up ",
                model: "Cohort",
                comparison: "Y5 vs Y2",
                readout: "Loss of response",
                paperRefs: [1, "2"],
            },
            couldNotVerify: ["Protocols missing"],
        });
        expect(parsed?.alreadyTried[0]).toEqual({
            paperIndex: 1,
            method: "RCT",
            finding: "12%",
        });
        expect(parsed?.nextMove?.title).toBe("Extend follow-up");
        expect(parsed?.nextMove?.paperRefs).toEqual([1, 2]);
    });

    it("returns null when nothing usable is present", () => {
        expect(parseProjectBriefing(null)).toBeNull();
        expect(parseProjectBriefing({ alreadyTried: [] })).toBeNull();
    });
});

describe("fallbackProjectBriefing", () => {
    it("lifts methods and open questions from extractions", () => {
        const briefing = fallbackProjectBriefing({
            gap,
            papers: [],
            extractions: [extraction],
        });
        expect(briefing.alreadyTried[0]).toEqual({
            paperIndex: 1,
            method: "Double-blind RCT, n=210",
            finding: "12% reduction",
        });
        expect(briefing.stillOpen[0]).toBe("Durability past year 3?");
        expect(briefing.nextMove?.title).toBe(gap.title);
        expect(briefing.nextMove?.paperRefs).toEqual([1, 2]);
    });
});

describe("generateProjectBriefing", () => {
    beforeEach(() => {
        createPrivateChatCompletion.mockReset();
    });

    it("parses a structured briefing from the model", async () => {
        createPrivateChatCompletion.mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(validBriefing) } }],
        });
        const result = await generateProjectBriefing(
            {
                gap,
                papers: [{ index: 1, title: "Example trial" }],
                extractions: [extraction],
            },
            { feature: "projects", userID: "user-1" },
        );
        expect(result.usedFallback).toBe(false);
        expect(result.briefing.nextMove?.readout).toBe("Time to loss of response");
        expect(createPrivateChatCompletion.mock.calls[0][0].model).toBe(
            BRIEFING_MODEL,
        );
        expect(createPrivateChatCompletion.mock.calls[0][0].messages[0].content).toContain(
            "Do not assign reading",
        );
    });

    it("falls back when the model cannot return JSON", async () => {
        createPrivateChatCompletion.mockRejectedValue(new Error("offline"));
        const result = await generateProjectBriefing({
            gap,
            papers: [],
            extractions: [extraction],
        });
        expect(result.usedFallback).toBe(true);
        expect(result.briefing.alreadyTried[0].method).toContain("RCT");
    });
});
