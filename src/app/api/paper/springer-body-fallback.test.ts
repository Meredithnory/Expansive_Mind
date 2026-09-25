import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormattedPaper } from "../general-interfaces";
import {
    SPRINGER_OPEN_BODY_NOTICE,
    adoptPmcBodyForSpringerPaper,
    findPmcIdForDoiViaEuropePmc,
    loadOpenFullTextForSpringerDoi,
    paperHasBodySections,
} from "./springer-body-fallback";

afterEach(() => {
    vi.unstubAllGlobals();
});

const springerIdentity = {
    title: "Springer title",
    authors: ["Springer, A"],
    paperId: "10.1186/s41073-026-00245-8",
    idName: "doi",
    primarySource: "Springer Nature",
    abstract: "Springer abstract",
    publicationDate: "2026-01-01",
    canonicalUrl: "https://doi.org/10.1186/s41073-026-00245-8",
};

const allowedAccess = {
    rawLicense: "CC BY 4.0",
    normalizedLicense: "CC-BY" as const,
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    canonicalUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12345/",
    attribution: {
        title: "PMC title",
        authors: ["Pmc, A"],
        sourceLabel: "NIH PubMed Central",
        canonicalUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12345/",
        paperId: "12345",
        idName: "pmcid",
        doi: "10.1186/s41073-026-00245-8",
    },
    policyReason: "allowed",
    policyReasonCode: "allowed_cc_by" as const,
    canDisplayFullText: true,
    canSendToAI: true,
    canPersistContent: true,
    canUseImages: true,
};

function pmcPaper(overrides: Partial<FormattedPaper> = {}): FormattedPaper {
    return {
        title: "PMC title",
        authors: ["Pmc, A"],
        paperId: "12345",
        idName: "pmcid",
        primarySource: "NIH PubMed Central",
        source: "nih",
        paper: [
            { title: "Abstract", content: "Abstract text", subSections: [] },
            {
                title: "Methods",
                content: "We sequenced the samples.",
                subSections: [],
            },
        ],
        abstract: "Abstract text",
        access: allowedAccess,
        ...overrides,
    };
}

describe("paperHasBodySections", () => {
    it("ignores abstract-only section lists", () => {
        expect(
            paperHasBodySections([
                { title: "Abstract", content: "Only this", subSections: [] },
            ]),
        ).toBe(false);
        expect(paperHasBodySections([])).toBe(false);
    });

    it("detects non-abstract body content", () => {
        expect(
            paperHasBodySections([
                { title: "Abstract", content: "Abs", subSections: [] },
                { title: "Results", content: "Findings", subSections: [] },
            ]),
        ).toBe(true);
    });
});

describe("findPmcIdForDoiViaEuropePmc", () => {
    it("returns the PMC id for an exact DOI match in PMC", async () => {
        const fetch = vi.fn().mockResolvedValue(
            Response.json({
                resultList: {
                    result: [
                        {
                            doi: "10.1186/s41073-026-00245-8",
                            pmcid: "PMC999001",
                        },
                    ],
                },
            }),
        );

        await expect(
            findPmcIdForDoiViaEuropePmc(
                "https://doi.org/10.1186/s41073-026-00245-8",
                fetch as unknown as typeof globalThis.fetch,
            ),
        ).resolves.toBe("999001");

        const url = new URL(String(fetch.mock.calls[0][0]));
        expect(url.searchParams.get("query")).toBe(
            'DOI:"10.1186/s41073-026-00245-8" AND IN_PMC:Y',
        );
    });

    it("skips non-matching DOIs and missing PMC ids", async () => {
        const fetch = vi.fn().mockResolvedValue(
            Response.json({
                resultList: {
                    result: [
                        { doi: "10.9999/other", pmcid: "PMC1" },
                        { doi: "10.1186/s41073-026-00245-8", pmcid: null },
                    ],
                },
            }),
        );

        await expect(
            findPmcIdForDoiViaEuropePmc(
                "10.1186/s41073-026-00245-8",
                fetch as unknown as typeof globalThis.fetch,
            ),
        ).resolves.toBeNull();
    });

    it("returns null when Europe PMC is unavailable", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(new Response("nope", { status: 503 }));

        await expect(
            findPmcIdForDoiViaEuropePmc(
                "10.1186/s41073-026-00245-8",
                fetch as unknown as typeof globalThis.fetch,
            ),
        ).resolves.toBeNull();
    });
});

describe("adoptPmcBodyForSpringerPaper", () => {
    it("keeps Springer identity and names NIH PMC as the body source", () => {
        const adopted = adoptPmcBodyForSpringerPaper(
            springerIdentity,
            pmcPaper(),
        );

        expect(adopted).toMatchObject({
            source: "springer",
            paperId: springerIdentity.paperId,
            idName: "doi",
            primarySource: "Springer Nature",
            contentNotice: SPRINGER_OPEN_BODY_NOTICE,
            access: {
                canSendToAI: true,
                canDisplayFullText: true,
                attribution: {
                    paperId: springerIdentity.paperId,
                    idName: "doi",
                    doi: springerIdentity.paperId,
                    sourceLabel: "Springer Nature",
                    canonicalUrl:
                        "https://pmc.ncbi.nlm.nih.gov/articles/PMC12345/",
                },
            },
        });
        expect(paperHasBodySections(adopted!.paper)).toBe(true);
        expect(adopted!.paper.some((s) => s.title === "Methods")).toBe(true);
    });

    it("rejects PMC records without displayable body text", () => {
        expect(
            adoptPmcBodyForSpringerPaper(
                springerIdentity,
                pmcPaper({
                    paper: [
                        {
                            title: "Abstract",
                            content: "Only abstract",
                            subSections: [],
                        },
                    ],
                }),
            ),
        ).toBeNull();

        expect(
            adoptPmcBodyForSpringerPaper(
                springerIdentity,
                pmcPaper({
                    access: {
                        ...allowedAccess,
                        canDisplayFullText: false,
                        canSendToAI: false,
                    },
                    paper: [],
                }),
            ),
        ).toBeNull();
    });
});

describe("loadOpenFullTextForSpringerDoi", () => {
    it("loads PMC body when Europe PMC resolves the DOI", async () => {
        const loadPmcPaper = vi.fn().mockResolvedValue(pmcPaper());
        const result = await loadOpenFullTextForSpringerDoi({
            doi: springerIdentity.paperId,
            title: springerIdentity.title,
            authors: springerIdentity.authors,
            primarySource: springerIdentity.primarySource,
            idName: springerIdentity.idName,
            abstract: springerIdentity.abstract,
            publicationDate: springerIdentity.publicationDate,
            canonicalUrl: springerIdentity.canonicalUrl,
            findPmcId: async () => "12345",
            loadPmcPaper,
        });

        expect(loadPmcPaper).toHaveBeenCalledWith(
            "12345",
            "NIH PubMed Central",
            "pmcid",
        );
        expect(result?.contentNotice).toBe(SPRINGER_OPEN_BODY_NOTICE);
        expect(result?.paper.some((s) => s.title === "Methods")).toBe(true);
    });

    it("keeps abstract-only when Europe PMC has no PMC copy", async () => {
        const loadPmcPaper = vi.fn();
        await expect(
            loadOpenFullTextForSpringerDoi({
                doi: springerIdentity.paperId,
                title: springerIdentity.title,
                authors: springerIdentity.authors,
                primarySource: springerIdentity.primarySource,
                idName: springerIdentity.idName,
                canonicalUrl: springerIdentity.canonicalUrl,
                findPmcId: async () => null,
                loadPmcPaper,
            }),
        ).resolves.toBeNull();
        expect(loadPmcPaper).not.toHaveBeenCalled();
    });
});
