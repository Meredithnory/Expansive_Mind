import { describe, expect, it } from "vitest";
import type { ContentAccessPolicy } from "../../lib/content-access-policy";
import {
    filterAiEligible,
    selectDiscoverCandidates,
    dedupeDiscoverCandidates,
    type DiscoverCandidate,
} from "./select-candidates";

const allowedAccess = (
    overrides: Partial<ContentAccessPolicy> = {},
): ContentAccessPolicy => ({
    rawLicense: "CC BY 4.0",
    normalizedLicense: "CC-BY",
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    canonicalUrl: "https://example.com",
    attribution: {
        title: "Example",
        authors: ["Author"],
        sourceLabel: "Springer Nature",
        canonicalUrl: "https://example.com",
        paperId: "10.1000/example",
        idName: "doi",
    },
    policyReason: "allowed",
    policyReasonCode: "allowed_cc_by",
    canDisplayFullText: true,
    canSendToAI: true,
    canPersistContent: true,
    canUseImages: false,
    ...overrides,
});

const blockedAccess = (): ContentAccessPolicy =>
    allowedAccess({
        canSendToAI: false,
        canDisplayFullText: false,
        canPersistContent: false,
        normalizedLicense: "OTHER",
        policyReasonCode: "license_not_permitted",
    });

const springerCandidate = (
    id: string,
    access: ContentAccessPolicy = allowedAccess(),
): DiscoverCandidate => ({
    database: "springer",
    paperId: id,
    idName: "doi",
    title: `Springer ${id}`,
    authors: ["A"],
    date: "2024",
    abstract: "Abstract",
    sourceLabel: "Springer Nature",
    sourceUrl: `https://doi.org/${id}`,
    doi: id,
    access,
});

const nihCandidate = (
    id: string,
    access: ContentAccessPolicy = allowedAccess({
        attribution: {
            title: `NIH ${id}`,
            authors: ["B"],
            sourceLabel: "NIH PubMed Central",
            canonicalUrl: `https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/`,
            paperId: id,
            idName: "pmcid",
        },
    }),
): DiscoverCandidate => ({
    database: "nih",
    paperId: id,
    idName: "pmcid",
    title: `NIH ${id}`,
    authors: ["B"],
    date: "2023",
    abstract: "Abstract",
    sourceLabel: "NIH PubMed Central",
    sourceUrl: `https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/`,
    access,
});

const scholarCandidate = (
    id: string,
    access: ContentAccessPolicy = allowedAccess({
        attribution: {
            title: `Scholar ${id}`,
            authors: ["C"],
            sourceLabel: "Google Scholar",
            canonicalUrl: `https://scholar.google.com/scholar?cluster=${id}`,
            paperId: id,
            idName: "cluster_id",
        },
        policyReasonCode: "legacy_live_access",
    }),
): DiscoverCandidate => ({
    database: "scholar",
    paperId: id,
    idName: "cluster_id",
    title: `Scholar ${id}`,
    authors: ["C"],
    date: "2022",
    abstract: "Snippet",
    sourceLabel: "Google Scholar",
    sourceUrl: `https://scholar.google.com/scholar?cluster=${id}`,
    access,
});

describe("filterAiEligible", () => {
    it("keeps only papers approved for AI processing", () => {
        const candidates = [
            springerCandidate("10.1/a"),
            springerCandidate("10.1/b", blockedAccess()),
            nihCandidate("111"),
            scholarCandidate("abc", blockedAccess()),
        ];
        expect(filterAiEligible(candidates).map((c) => c.paperId)).toEqual([
            "10.1/a",
            "111",
        ]);
    });
});

describe("selectDiscoverCandidates", () => {
    it("takes the top ten AI-eligible papers from a ranked mix of sources", () => {
        const ranked = [
            nihCandidate("1"),
            springerCandidate("10.1/a"),
            scholarCandidate("s1"),
            nihCandidate("2"),
            springerCandidate("10.1/b"),
            scholarCandidate("s2"),
            nihCandidate("3"),
            springerCandidate("10.1/c"),
            scholarCandidate("s3"),
            nihCandidate("4"),
            springerCandidate("10.1/d"),
            scholarCandidate("s4"),
        ];
        const selected = selectDiscoverCandidates({ ranked });

        expect(selected).toHaveLength(10);
        expect(selected.map((c) => c.paperId)).toEqual([
            "1",
            "10.1/a",
            "s1",
            "2",
            "10.1/b",
            "s2",
            "3",
            "10.1/c",
            "s3",
            "4",
        ]);
        expect(selected.some((c) => c.database === "nih")).toBe(true);
        expect(selected.some((c) => c.database === "springer")).toBe(true);
        expect(selected.some((c) => c.database === "scholar")).toBe(true);
    });

    it("includes NIH and Scholar even when Springer already has ten eligible papers", () => {
        const selected = selectDiscoverCandidates({
            ranked: [
                nihCandidate("1"),
                scholarCandidate("s1"),
                ...[
                    "10.1/a",
                    "10.1/b",
                    "10.1/c",
                    "10.1/d",
                    "10.1/e",
                    "10.1/f",
                    "10.1/g",
                    "10.1/h",
                    "10.1/i",
                    "10.1/j",
                    "10.1/k",
                ].map((id) => springerCandidate(id)),
            ],
        });

        expect(selected).toHaveLength(10);
        expect(selected[0].database).toBe("nih");
        expect(selected[1].database).toBe("scholar");
        expect(selected.filter((c) => c.database === "springer")).toHaveLength(
            8,
        );
    });

    it("skips blocked licenses and dedupes by DOI across sources", () => {
        const sharedDoi = "10.1/shared";
        const selected = selectDiscoverCandidates({
            springer: [springerCandidate(sharedDoi)],
            nih: [
                {
                    ...nihCandidate("999"),
                    doi: sharedDoi,
                },
                nihCandidate("1000"),
            ],
            scholar: [scholarCandidate("s1", blockedAccess())],
        });

        expect(selected.map((c) => c.paperId)).toEqual([sharedDoi, "1000"]);
        expect(selected).toHaveLength(2);
    });

    it("returns empty when no AI-eligible papers exist", () => {
        const selected = selectDiscoverCandidates({
            springer: [springerCandidate("10.1/a", blockedAccess())],
            nih: [nihCandidate("1", blockedAccess())],
            scholar: [scholarCandidate("s1", blockedAccess())],
        });
        expect(selected).toEqual([]);
    });
});

describe("dedupeDiscoverCandidates", () => {
    it("dedupes Springer by DOI, NIH by PMCID, and Scholar by cluster id", () => {
        const unique = dedupeDiscoverCandidates([
            springerCandidate("10.1/a"),
            springerCandidate("10.1/A"),
            nihCandidate("111"),
            nihCandidate("111"),
            nihCandidate("222"),
            scholarCandidate("cluster-1"),
            scholarCandidate("cluster-1"),
        ]);
        expect(unique.map((c) => c.paperId)).toEqual([
            "10.1/a",
            "111",
            "222",
            "cluster-1",
        ]);
    });
});
