import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    loadCachedPaperBySource: vi.fn(),
}));

vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: unknown) => handler,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: () =>
        Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock("../../paper/load-paper", () => ({
    loadCachedPaperBySource: mocks.loadCachedPaperBySource,
}));
vi.mock("../../../models/PaperShare", () => ({
    default: { findOne: mocks.findOne },
}));

import { GET } from "./route";

const SLUG = "abcdefghijklmnopqrstuv";

const share = {
    ownerName: "Ada Lovelace",
    database: "nih",
    paperId: "1234567",
    idName: "pmcid",
    title: "A paper",
    authors: ["A. Author"],
    sourceLabel: "NIH PubMed Central",
    canonicalUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/",
    publicationDate: "2024",
    highlights: [
        {
            excerpt: "Sample size was 42.",
            citation: {
                sectionTitle: "Results",
                startLine: 3,
                endLine: 4,
                lines: ["Sample size", "was 42."],
            },
        },
    ],
    updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function paperWithLicense(licenseUrl: string | null) {
    return {
        value: {
            source: "nih",
            paper: [{ title: "Results", content: "Sample size was 42." }],
            access: { rawLicense: null, licenseUrl },
        },
    };
}

function request() {
    return {
        user: { _id: { toString: () => "viewer-1" } },
        nextUrl: { pathname: `/api/paper-shares/${SLUG}` },
    } as never;
}

describe("GET /api/paper-shares/[slug]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findOne.mockReturnValue({ lean: () => Promise.resolve(share) });
    });

    it("shows passage text for a CC BY paper", async () => {
        mocks.loadCachedPaperBySource.mockResolvedValue(
            paperWithLicense("https://creativecommons.org/licenses/by/4.0/"),
        );
        const body = await (await GET(request())).json();
        expect(body.share.quotable).toBe(true);
        expect(body.share.highlights[0].excerpt).toBe("Sample size was 42.");
        expect(body.share.highlights[0].citation.lines).toHaveLength(2);
    });

    it("hides passage text for a non-commercial paper", async () => {
        mocks.loadCachedPaperBySource.mockResolvedValue(
            paperWithLicense("https://creativecommons.org/licenses/by-nc/4.0/"),
        );
        const body = await (await GET(request())).json();
        expect(body.share.quotable).toBe(false);
        expect(body.share.highlights[0].excerpt).toBeNull();
        expect(body.share.highlights[0].citation.lines).toEqual([]);
        expect(body.share.highlights[0].href).toContain("lines=3-4");
    });

    it("hides passage text when the paper cannot be loaded", async () => {
        mocks.loadCachedPaperBySource.mockRejectedValue(new Error("down"));
        const body = await (await GET(request())).json();
        expect(body.share.highlights[0].excerpt).toBeNull();
    });
});
