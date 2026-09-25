import { describe, expect, it } from "vitest";
import type { DiscoverPaperCard } from "../api/discover/report-types";
import type { DiscoverResponse } from "./discover-types";

const card: DiscoverPaperCard = {
    index: 1,
    database: "nih",
    paperId: "1234567",
    idName: "pmcid",
    title: "Example",
    authors: ["Doe"],
    date: "2024",
    sourceLabel: "NIH PubMed Central",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/",
    href: "/paperchatbot/nih/1234567",
};

describe("discover shared types", () => {
    it("uses one paper-card shape for the agent and the client response", () => {
        const response: DiscoverResponse = {
            id: "disc-1",
            createdAt: "2024-01-01T00:00:00.000Z",
            question: "Why does CAR-T fail in solid tumors?",
            papers: [card],
            brief: "Synthesis",
            meta: {
                springerCandidateCount: 0,
                springerEligibleCount: 0,
                nihFillCount: 1,
                papersUsed: 1,
                usedNihFill: true,
            },
        };

        expect(response.papers[0]).toEqual(card);
        expect(response.papers[0].href).toMatch(/^\/paperchatbot\//);
    });
});
