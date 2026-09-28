import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    consumeRateLimit: vi.fn(),
    nih: vi.fn(),
    springer: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("../../../models/PaperHighlight", () => ({
    default: { find: mocks.find },
}));
vi.mock("../../search/utils", () => ({ getNIHPaperResults: mocks.nih }));
vi.mock("../../paper/utils", () => ({ getSpringerPaperMetadata: mocks.springer }));

import { GET } from "./route";

const citation = { sectionTitle: "Results", startLine: 1, endLine: 1, lines: ["x"] };

function doc(id: string, over: Record<string, unknown>) {
    return {
        _id: { toString: () => id },
        excerpt: `excerpt ${id}`,
        citation,
        color: "pink",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        primarySource: "Springer Nature",
        paperId: "10.1186/abc",
        idName: "doi",
        ...over,
    };
}

function request() {
    const next = new NextRequest("https://example.test/api/highlights/all");
    next.user = { _id: { toString: () => "user-1" } };
    return next;
}

describe("GET /api/highlights/all", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.consumeRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
        mocks.find.mockReturnValue({
            sort: () => ({
                limit: () => ({
                    lean: () =>
                        Promise.resolve([
                            doc("a", {}),
                            doc("b", {
                                primarySource: "NIH PubMed Central",
                                paperId: "123",
                                idName: "pmcid",
                            }),
                            doc("c", {
                                primarySource: "Google Scholar",
                                paperId: "xyz",
                                idName: "cluster_id",
                            }),
                        ]),
                }),
            }),
        });
        mocks.nih.mockResolvedValue([{ pmcid: "123", title: "NIH title" }]);
        mocks.springer.mockResolvedValue([{ paperId: "10.1186/abc", title: "Springer title" }]);
    });

    it("returns only the signed-in user's highlights grouped with titles", async () => {
        const response = await GET(request());
        expect(response.status).toBe(200);
        expect(mocks.find).toHaveBeenCalledWith({ userID: expect.anything() });
        const body = await response.json();
        expect(body.total).toBe(3);
        const titles = body.papers.map((paper: { title: string }) => paper.title);
        expect(titles).toContain("Springer title");
        expect(titles).toContain("NIH title");
        expect(titles).toContain("Google Scholar · xyz");
    });

    it("keeps working when a title lookup fails", async () => {
        mocks.springer.mockRejectedValue(new Error("down"));
        const response = await GET(request());
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(
            body.papers.map((paper: { title: string }) => paper.title),
        ).toContain("Springer Nature · 10.1186/abc");
    });

    it("rate-limits", async () => {
        mocks.consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });
        const response = await GET(request());
        expect(response.status).toBe(429);
        expect(mocks.find).not.toHaveBeenCalled();
    });
});
