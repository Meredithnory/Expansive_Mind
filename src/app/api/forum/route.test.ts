import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    create: vi.fn(),
    followFind: vi.fn(),
    blockedBy: vi.fn(),
    snapshot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
    withOptionalAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: () => Promise.resolve({ allowed: true }),
}));
vi.mock("../../models/ForumPost", () => ({ default: { find: mocks.find, create: mocks.create } }));
vi.mock("../../models/Follow", () => ({ default: { find: mocks.followFind } }));
vi.mock("../../lib/shared-highlights", () => ({ snapshotSharedHighlights: mocks.snapshot }));
vi.mock("./view", () => ({
    viewerFrom: (user?: { _id: { toString(): string } }) => ({
        id: user ? user._id.toString() : null,
        isAdmin: false,
    }),
    blockedBy: mocks.blockedBy,
    loadPeople: () => Promise.resolve(() => ({ id: "a", name: "A", profileColor: null })),
    serializePost: (post: { _id: string }) => ({ id: post._id }),
}));

import { GET, POST } from "./route";

const ME = "64b000000000000000000001";
const BLOCKED = "64b000000000000000000002";

function get(query = "", signedIn = true) {
    const next = new NextRequest(`https://example.test/api/forum${query}`);
    if (signedIn) next.user = { _id: { toString: () => ME } };
    return next;
}

function post(body: unknown, submittedAt = "2026-01-01T00:00:00Z") {
    const next = new NextRequest("https://example.test/api/forum", {
        method: "POST",
        headers: { origin: "https://example.test", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    next.user = { _id: { toString: () => ME }, submittedAt };
    return next;
}

const chain = (rows: unknown[]) => ({
    sort: () => ({ limit: () => ({ lean: () => Promise.resolve(rows) }) }),
});

describe("forum feed", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.find.mockReturnValue(chain([]));
        mocks.blockedBy.mockResolvedValue([]);
    });

    it("shows only visible posts and skips people you blocked", async () => {
        mocks.blockedBy.mockResolvedValue([BLOCKED]);
        await GET(get());
        const filter = mocks.find.mock.calls[0][0];
        expect(filter.status).toBe("visible");
        expect(filter.authorID.$nin.map(String)).toEqual([BLOCKED]);
    });

    it("filters by a valid tag and ignores a bad one", async () => {
        await GET(get("?tag=crispr"));
        expect(mocks.find.mock.calls[0][0].tags).toBe("crispr");
        await GET(get("?tag=%24where"));
        expect(mocks.find.mock.calls[1][0].tags).toBeUndefined();
    });

    it("needs sign-in for the Following feed", async () => {
        const response = await GET(get("?feed=following", false));
        expect(response.status).toBe(401);
    });

    it("lets anyone read Latest without signing in", async () => {
        const response = await GET(get("", false));
        expect(response.status).toBe(200);
    });
});

describe("forum posting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.snapshot.mockResolvedValue({
            paperTitle: "A paper",
            quotable: false,
            highlights: [{ excerpt: null, sectionTitle: "Results", startLine: 1, endLine: 2, color: "pink" }],
        });
        mocks.create.mockResolvedValue({ _id: { toString: () => "p1" } });
    });

    const share = { database: "nih", paperId: "123", idName: "pmcid", body: "Worth reading", tags: "#Aging, crispr", highlightIds: ["x"] };

    it("makes brand-new accounts wait a day", async () => {
        const response = await POST(post(share, new Date().toISOString()));
        expect(response.status).toBe(403);
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("saves the licensed snapshot and normalized tags", async () => {
        const response = await POST(post(share));
        expect(response.status).toBe(201);
        expect(mocks.create).toHaveBeenCalledWith(
            expect.objectContaining({
                quotable: false,
                tags: ["aging", "crispr"],
                highlights: [expect.objectContaining({ excerpt: null })],
            }),
        );
    });
});
