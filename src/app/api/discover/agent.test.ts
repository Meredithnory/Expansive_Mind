import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    expandDiscoveryQueries,
    extractPaperFindings,
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
    getNIHPaperResults: vi.fn(),
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

function emptySearchMocks() {
    expandDiscoveryQueries.mockImplementation(async (question: string) => [
        question,
    ]);
    searchSpringerNaturePapers.mockResolvedValue({ results: [] });
    searchNIHPaperIds.mockResolvedValue({ ids: [] });
    searchGoogleScholarPapers.mockResolvedValue({ results: [] });
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
        expect(expandDiscoveryQueries).not.toHaveBeenCalled();
        expect(judgeResearchQuestion).not.toHaveBeenCalled();
    });

    it("returns a no-results outcome for junk with no papers and skips the NIH spell retry", async () => {
        judgeResearchQuestion.mockResolvedValue("not_research");

        const result = await runDiscoverAgent("asdfghjkl qwerty");

        expect(result.noResults).toBe(true);
        expect(result.papers).toEqual([]);
        expect(result.brief).toBe("");
        expect(result.report).toBeUndefined();
        expect(result.message).toBe(NO_RESULTS_COPY);
        expect(result.meta.papersUsed).toBe(0);
        expect(suggestSearchQueryNihOnly).not.toHaveBeenCalled();
        expect(synthesizeOpportunityReport).not.toHaveBeenCalled();
        expect(judgeResearchQuestion).toHaveBeenCalledWith(
            "asdfghjkl qwerty",
            undefined,
        );
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

    it("still writes a discovery report when papers exist, even if the quality model says junk", async () => {
        judgeResearchQuestion.mockResolvedValue("not_research");
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

        const result = await runDiscoverAgent("asdf but papers exist");

        expect(result.noResults).toBeUndefined();
        expect(result.papers).toHaveLength(1);
        expect(result.brief).toContain("GLP-1");
        expect(judgeResearchQuestion).not.toHaveBeenCalled();
        expect(suggestSearchQueryNihOnly).not.toHaveBeenCalled();
        expect(synthesizeOpportunityReport).toHaveBeenCalled();
    });
});
