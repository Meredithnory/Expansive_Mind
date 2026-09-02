import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    expandDiscoveryQueries,
    extractPaperFindings,
    getNIHPaperResults,
    isNihApiConfigured,
    judgeResearchQuestion,
    loadCachedPaperBySource,
    searchGoogleScholarPapers,
    searchNIHPaperIds,
    searchSpringerNaturePapers,
    suggestSearchQueryNihOnly,
    synthesizeOpportunityReport,
} = vi.hoisted(() => ({
    expandDiscoveryQueries: vi.fn(),
    extractPaperFindings: vi.fn(),
    getNIHPaperResults: vi.fn(),
    isNihApiConfigured: vi.fn(),
    judgeResearchQuestion: vi.fn(),
    loadCachedPaperBySource: vi.fn(),
    searchGoogleScholarPapers: vi.fn(),
    searchNIHPaperIds: vi.fn(),
    searchSpringerNaturePapers: vi.fn(),
    suggestSearchQueryNihOnly: vi.fn(),
    synthesizeOpportunityReport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../openrouter", () => ({
    createPrivateChatCompletion: vi.fn(),
}));
vi.mock("./expand-queries", () => ({ expandDiscoveryQueries }));
vi.mock("./analyze", () => ({
    extractPaperFindings,
    fallbackPaperExtraction: vi.fn(),
}));
vi.mock("./question-quality", async () => {
    const actual = await vi.importActual<typeof import("./question-quality")>(
        "./question-quality",
    );
    return {
        ...actual,
        judgeResearchQuestion,
    };
});
vi.mock("./synthesize", () => ({ synthesizeOpportunityReport }));
vi.mock("../search/spell-suggest", () => ({ suggestSearchQueryNihOnly }));
vi.mock("../search/semantic-rank", () => ({
    rankSearchResults: vi.fn(async (_question: string, results: unknown[]) => results),
}));
vi.mock("../search/utils", () => ({
    searchNIHPaperIds,
    getNIHPaperResults,
    searchSpringerNaturePapers,
    searchGoogleScholarPapers,
    isNihApiConfigured,
}));
vi.mock("../paper/load-paper", () => ({ loadCachedPaperBySource }));
vi.mock("../../lib/paper-context", () => ({
    selectPaperContext: vi.fn(() => "Licensed excerpt from the paper."),
}));

import { DiscoverAgentError, runDiscoverAgent } from "./agent";
import { NO_RESULTS_COPY } from "./question-quality";

const aiEligibleAccess = {
    canSendToAI: true,
    canonicalUrl: "https://doi.org/10.1000/glp1",
};

function expectNoLiteratureWork() {
    expect(expandDiscoveryQueries).not.toHaveBeenCalled();
    expect(suggestSearchQueryNihOnly).not.toHaveBeenCalled();
    expect(searchSpringerNaturePapers).not.toHaveBeenCalled();
    expect(searchNIHPaperIds).not.toHaveBeenCalled();
    expect(getNIHPaperResults).not.toHaveBeenCalled();
    expect(searchGoogleScholarPapers).not.toHaveBeenCalled();
    expect(loadCachedPaperBySource).not.toHaveBeenCalled();
    expect(extractPaperFindings).not.toHaveBeenCalled();
    expect(synthesizeOpportunityReport).not.toHaveBeenCalled();
}

function emptySearchMocks() {
    expandDiscoveryQueries.mockImplementation(async (question: string) => [
        question,
    ]);
    searchSpringerNaturePapers.mockResolvedValue({ results: [] });
    searchNIHPaperIds.mockResolvedValue({ ids: [] });
    searchGoogleScholarPapers.mockResolvedValue({ results: [] });
}

function mockPaperHit() {
    searchSpringerNaturePapers.mockResolvedValue({
        results: [
            {
                doi: "10.1000/glp1",
                title: "GLP-1 and cardiovascular outcomes",
                authors: ["A. Author"],
                date: "2024",
                abstract: "A trial of GLP-1 receptor agonists.",
                sourceUrl: "https://doi.org/10.1000/glp1",
                access: aiEligibleAccess,
            },
        ],
    });
    loadCachedPaperBySource.mockResolvedValue({
        value: {
            paperId: "10.1000/glp1",
            idName: "doi",
            title: "GLP-1 and cardiovascular outcomes",
            authors: ["A. Author"],
            publicationDate: "2024",
            primarySource: "Springer Nature",
            access: aiEligibleAccess,
        },
    });
    extractPaperFindings.mockResolvedValue({
        extraction: {
            index: 1,
            title: "GLP-1 and cardiovascular outcomes",
            sourceLabel: "Springer Nature",
            authors: ["A. Author"],
            publicationDate: "2024",
            keyFindings: ["Events fell."],
            methods: "RCT",
            limitations: [],
            openQuestions: [],
            evidenceType: "rct",
        },
        usedFallback: false,
    });
    synthesizeOpportunityReport.mockResolvedValue({
        brief: "## Consensus\nGLP-1 agonists reduce events.",
        report: {
            sections: {
                stateOfScience: "Events fell.",
                gaps: [],
                problems: [],
                venturePotential: [],
                couldNotVerify: [],
                projectSeeds: [],
            },
        },
    });
}

describe("runDiscoverAgent", () => {
    const originalSpringer = process.env.SPRINGER_API_KEY;
    const originalSerp = process.env.SERPAPI_KEY;

    beforeEach(() => {
        vi.clearAllMocks();
        isNihApiConfigured.mockReturnValue(true);
        process.env.SPRINGER_API_KEY = originalSpringer;
        process.env.SERPAPI_KEY = originalSerp;
        emptySearchMocks();
    });

    it("keeps the sources-configured check before any retrieval", async () => {
        isNihApiConfigured.mockReturnValue(false);
        delete process.env.SPRINGER_API_KEY;
        delete process.env.SERPAPI_KEY;

        await expect(runDiscoverAgent("anything")).rejects.toMatchObject({
            name: "DiscoverAgentError",
            status: 503,
            message: expect.stringContaining("No literature sources are configured"),
        });
        expect(judgeResearchQuestion).not.toHaveBeenCalled();
        expectNoLiteratureWork();
    });

    it("returns no-results for weijptw-style junk before expand, search, or paper reads", async () => {
        judgeResearchQuestion.mockResolvedValue("not_research");
        mockPaperHit();

        const result = await runDiscoverAgent("weijptw");

        expect(result.noResults).toBe(true);
        expect(result.papers).toEqual([]);
        expect(result.brief).toBe("");
        expect(result.report).toBeUndefined();
        expect(result.message).toBe(NO_RESULTS_COPY);
        expect(result.meta.papersUsed).toBe(0);
        expect(judgeResearchQuestion).toHaveBeenCalledWith("weijptw", undefined);
        expectNoLiteratureWork();
    });

    it("still searches and writes a report for a real PIH-style question", async () => {
        const question =
            "How does pulmonary arterial hypertension remodel the right ventricle?";
        judgeResearchQuestion.mockResolvedValue("research");
        mockPaperHit();

        const result = await runDiscoverAgent(question);

        expect(result.noResults).toBeUndefined();
        expect(result.papers).toHaveLength(1);
        expect(result.brief).toContain("GLP-1");
        expect(expandDiscoveryQueries).toHaveBeenCalledWith(question, undefined);
        expect(searchSpringerNaturePapers).toHaveBeenCalled();
        expect(loadCachedPaperBySource).toHaveBeenCalled();
        expect(synthesizeOpportunityReport).toHaveBeenCalled();
        expect(suggestSearchQueryNihOnly).not.toHaveBeenCalled();
    });

    it("keeps the spelling retry for a real question with no first-pass papers", async () => {
        judgeResearchQuestion.mockResolvedValue("research");
        suggestSearchQueryNihOnly.mockResolvedValue(
            "GLP-1 receptor agonism cardiovascular outcomes",
        );

        await expect(
            runDiscoverAgent(
                "How does GLP-1 receptor agonism affect cardiovascular outcomes?",
            ),
        ).rejects.toBeInstanceOf(DiscoverAgentError);

        expect(suggestSearchQueryNihOnly).toHaveBeenCalled();
        expect(expandDiscoveryQueries).toHaveBeenCalledTimes(2);
        expect(synthesizeOpportunityReport).not.toHaveBeenCalled();
    });

    it("still runs discovery when the cheap classifier is unsure", async () => {
        judgeResearchQuestion.mockResolvedValue("unknown");
        mockPaperHit();

        const result = await runDiscoverAgent(
            "How does GLP-1 receptor agonism affect cardiovascular outcomes?",
        );

        expect(result.papers).toHaveLength(1);
        expect(expandDiscoveryQueries).toHaveBeenCalled();
        expect(searchSpringerNaturePapers).toHaveBeenCalled();
        expect(synthesizeOpportunityReport).toHaveBeenCalled();
    });
});
