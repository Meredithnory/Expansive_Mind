import { describe, expect, it } from "vitest";
import type { FormattedPaper } from "../api/general-interfaces";
import { queryTerms, selectChatContext } from "./chat-context";

const filler = (topic: string, n: number) =>
    Array.from(
        { length: n },
        (_, i) => `Background sentence ${i} about ${topic} context and prior work.`,
    ).join(" ");

function paper(): FormattedPaper {
    return {
        title: "Test paper",
        abstract: "",
        paper: [
            { title: "Abstract", content: "We tested drug X in mice.", subSections: [] },
            {
                title: "Introduction",
                content: filler("inflammation", 20),
                subSections: [],
            },
            {
                title: "Methods",
                content: "",
                subSections: [
                    {
                        title: "Statistical analysis",
                        content:
                            "Group differences were tested with a two-way ANOVA and Tukey correction; n = 12 mice per group.",
                    },
                ],
            },
            {
                title: "Results",
                content: `${filler("tumor growth", 30)}\n\nDrug X reduced tumor volume by 41% versus vehicle at day 21 (p < 0.01).`,
                subSections: [],
            },
            {
                title: "Discussion",
                content:
                    "A key limitation is that only male mice were used, which limits generalizability.",
                subSections: [],
            },
            {
                title: "References",
                content: "1. Smith J. Tumor volume ANOVA limitation mice. 2020.",
                subSections: [],
            },
        ],
    } as unknown as FormattedPaper;
}

describe("queryTerms", () => {
    it("drops filler words so they cannot drive retrieval", () => {
        expect(queryTerms("What does this paper say about the ANOVA?")).toEqual(["anova"]);
    });
});

describe("selectChatContext", () => {
    it("reads subsections (Methods text often lives only there)", () => {
        const context = selectChatContext(paper(), "Which statistical test did they use?");
        expect(context).toContain("two-way ANOVA");
        expect(context).toContain("### Statistical analysis");
    });

    it("finds a result deep inside a long section", () => {
        const context = selectChatContext(paper(), "How much did drug X reduce tumor volume?");
        expect(context).toContain("reduced tumor volume by 41%");
    });

    it("uses the previous question for a short follow-up", () => {
        const context = selectChatContext(
            paper(),
            "And the limitation?",
            "Were only male mice used?",
        );
        expect(context).toContain("only male mice");
    });

    it("never sends the reference list", () => {
        const context = selectChatContext(paper(), "tumor volume ANOVA limitation mice");
        expect(context).not.toContain("Smith J.");
    });

    it("keeps passages in paper order under real section headings", () => {
        const context = selectChatContext(paper(), "ANOVA and tumor volume limitation");
        const methods = context.indexOf("## Methods");
        const results = context.indexOf("reduced tumor volume");
        const discussion = context.indexOf("only male mice");
        expect(methods).toBeGreaterThan(-1);
        expect(methods).toBeLessThan(results);
        expect(results).toBeLessThan(discussion);
    });

    it("stays within the context budget", () => {
        const big = paper();
        big.paper[1].content = Array.from({ length: 40 }, () => filler("inflammation", 12)).join("\n\n");
        expect(selectChatContext(big, "inflammation background").length).toBeLessThanOrEqual(12_500);
    });

    it("falls back to each section's opening when nothing matches", () => {
        const context = selectChatContext(paper(), "Hi!");
        expect(context).toContain("## Introduction");
        expect(context).toContain("## Discussion");
    });
});
