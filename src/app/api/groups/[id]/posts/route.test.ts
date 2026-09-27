import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const GROUP = "64b0000000000000000000a1";
const H1 = "64b0000000000000000000b1";

const mocks = vi.hoisted(() => ({
    loadMembership: vi.fn(),
    highlightFind: vi.fn(),
    postCreate: vi.fn(),
    loadPaper: vi.fn(),
    quote: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../access", () => ({ loadMembership: mocks.loadMembership }));
vi.mock("../../../../lib/rate-limit", () => ({
    consumeRateLimit: () => Promise.resolve({ allowed: true }),
}));
vi.mock("../../../../models/PaperHighlight", () => ({
    default: { find: mocks.highlightFind },
}));
vi.mock("../../../../models/GroupPost", () => ({
    default: { create: mocks.postCreate, deleteOne: vi.fn() },
}));
vi.mock("../../../../models/GroupComment", () => ({ default: { deleteMany: vi.fn() } }));
vi.mock("../../../paper/load-paper", () => ({ loadCachedPaperBySource: mocks.loadPaper }));
vi.mock("../../../../lib/quote-eligibility", () => ({
    evaluateQuoteEligibility: mocks.quote,
    paperHasFullTextBody: () => true,
    quoteLicenseFromHome: () => ({ rawLicense: null, licenseUrl: null }),
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: GROUP }) };

function request(body: unknown) {
    const next = new NextRequest(`https://example.test/api/groups/${GROUP}/posts`, {
        method: "POST",
        headers: { origin: "https://example.test", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    next.user = { _id: { toString: () => "user-1" } };
    return next;
}

const share = {
    database: "springer",
    paperId: "10.1186/abc",
    idName: "doi",
    note: "Look at the methods",
    highlightIds: [H1],
};

describe("POST /api/groups/[id]/posts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.loadMembership.mockResolvedValue({ role: "member", group: {} });
        mocks.highlightFind.mockReturnValue({
            sort: () => ({
                lean: () =>
                    Promise.resolve([
                        {
                            _id: H1,
                            excerpt: "Mice were dosed daily.",
                            color: "blue",
                            citation: { sectionTitle: "Methods", startLine: 10, endLine: 11 },
                        },
                    ]),
            }),
        });
        mocks.loadPaper.mockResolvedValue({
            value: { title: "A paper", access: {}, paper: [] },
        });
        mocks.postCreate.mockResolvedValue({ _id: { toString: () => "post-1" } });
    });

    it("hides a group from non-members", async () => {
        mocks.loadMembership.mockResolvedValue(null);
        const response = await POST(request(share), context);
        expect(response.status).toBe(404);
        expect(mocks.postCreate).not.toHaveBeenCalled();
    });

    it("only looks up the sharer's own highlights on this paper", async () => {
        mocks.quote.mockReturnValue({ allowed: true });
        await POST(request(share), context);
        expect(mocks.highlightFind).toHaveBeenCalledWith(
            expect.objectContaining({
                userID: expect.anything(),
                primarySource: "Springer Nature",
                paperId: "10.1186/abc",
                idName: "doi",
            }),
        );
    });

    it("keeps the quoted text for open-license papers", async () => {
        mocks.quote.mockReturnValue({ allowed: true });
        const response = await POST(request(share), context);
        expect(response.status).toBe(201);
        const saved = mocks.postCreate.mock.calls[0][0];
        expect(saved.quotable).toBe(true);
        expect(saved.highlights[0]).toMatchObject({
            excerpt: "Mice were dosed daily.",
            sectionTitle: "Methods",
            startLine: 10,
            endLine: 11,
        });
    });

    it("stores location only when the license blocks quoting", async () => {
        mocks.quote.mockReturnValue({ allowed: false });
        await POST(request(share), context);
        const saved = mocks.postCreate.mock.calls[0][0];
        expect(saved.quotable).toBe(false);
        expect(saved.highlights[0].excerpt).toBeNull();
        expect(saved.highlights[0].sectionTitle).toBe("Methods");
    });

    it("rejects an unknown source", async () => {
        const response = await POST(request({ ...share, database: "elsewhere" }), context);
        expect(response.status).toBe(400);
    });
});
