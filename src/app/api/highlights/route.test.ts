import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
    loadCachedPaperBySource: vi.fn(),
}));

vi.mock("../authMiddleware", () => ({
    withAuth: (handler: unknown) => handler,
}));
vi.mock("../../lib/request-security", () => ({
    hasValidMutationOrigin: () => true,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: () =>
        Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock("../paper/load-paper", () => ({
    loadCachedPaperBySource: mocks.loadCachedPaperBySource,
}));
vi.mock("../../models/PaperHighlight", () => ({
    default: {
        find: mocks.find,
        countDocuments: mocks.countDocuments,
        create: mocks.create,
        deleteOne: mocks.deleteOne,
    },
}));

import { DELETE, GET, POST } from "./route";

const paper = {
    access: {
        canPersistContent: true,
        policyReason: "Allowed",
    },
};

function requestWithUser(body?: Record<string, unknown>) {
    return {
        user: { _id: { toString: () => "user-1" } },
        nextUrl: {
            searchParams: new URLSearchParams({
                database: "nih",
                paperId: "1234567",
                idName: "pmcid",
            }),
        },
        json: async () => body || {},
    } as never;
}

describe("highlights API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.find.mockReturnValue({
            sort: () => ({
                limit: () => ({
                    lean: () =>
                        Promise.resolve([
                            {
                                _id: { toString: () => "hl-1" },
                                excerpt: "Sample size was 42.",
                                citation: {
                                    sectionTitle: "Abstract",
                                    startLine: 1,
                                    endLine: 1,
                                    lines: ["Sample size was 42."],
                                },
                            },
                        ]),
                }),
            }),
        });
        mocks.loadCachedPaperBySource.mockResolvedValue({ value: paper });
        mocks.countDocuments.mockResolvedValue(0);
        mocks.create.mockResolvedValue({
            _id: { toString: () => "hl-2" },
            excerpt: "Sample size was 42.",
            citation: {
                sectionTitle: "Abstract",
                startLine: 1,
                endLine: 1,
                lines: ["Sample size was 42."],
            },
        });
        mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    });

    it("lists highlights for the signed-in user and paper", async () => {
        const response = await GET(requestWithUser());
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.highlights).toEqual([
            {
                id: "hl-1",
                excerpt: "Sample size was 42.",
                citation: {
                    sectionTitle: "Abstract",
                    startLine: 1,
                    endLine: 1,
                    lines: ["Sample size was 42."],
                },
            },
        ]);
    });

    it("saves a highlight for the signed-in user and paper", async () => {
        const response = await POST(
            requestWithUser({
                database: "nih",
                paperId: "1234567",
                idName: "pmcid",
                excerpt: "Sample size was 42.",
                citation: {
                    sectionTitle: "Abstract",
                    startLine: 1,
                    endLine: 1,
                    lines: ["Sample size was 42."],
                },
            }),
        );
        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.highlight.id).toBe("hl-2");
        expect(mocks.create).toHaveBeenCalled();
    });

    it("does not persist highlights when the paper forbids stored content", async () => {
        mocks.loadCachedPaperBySource.mockResolvedValue({
            value: {
                access: {
                    canPersistContent: false,
                    policyReason: "License does not permit storage.",
                },
            },
        });
        const response = await POST(
            requestWithUser({
                database: "nih",
                paperId: "1234567",
                idName: "pmcid",
                excerpt: "Sample size was 42.",
                citation: {
                    sectionTitle: "Abstract",
                    startLine: 1,
                    endLine: 1,
                    lines: ["Sample size was 42."],
                },
            }),
        );
        expect(response.status).toBe(403);
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("deletes only the signed-in user's highlight", async () => {
        const response = await DELETE(
            requestWithUser({ highlightId: "64b0f0f0f0f0f0f0f0f0f0f0" }),
        );
        expect(response.status).toBe(200);
        expect(mocks.deleteOne).toHaveBeenCalledWith({
            _id: "64b0f0f0f0f0f0f0f0f0f0f0",
            userID: { toString: expect.any(Function) },
        });
    });
});
