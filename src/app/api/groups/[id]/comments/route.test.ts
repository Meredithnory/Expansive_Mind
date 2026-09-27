import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const GROUP = "64b0000000000000000000a1";
const POST_ID = "64b0000000000000000000c1";
const HIGHLIGHT = "64b0000000000000000000d1";
const OTHER = "64b0000000000000000000d2";

const mocks = vi.hoisted(() => ({
    loadMembership: vi.fn(),
    postFindOne: vi.fn(),
    commentCreate: vi.fn(),
    commentDeleteOne: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../access", () => ({ loadMembership: mocks.loadMembership }));
vi.mock("../../../../lib/rate-limit", () => ({
    consumeRateLimit: () => Promise.resolve({ allowed: true }),
}));
vi.mock("../../../../models/GroupPost", () => ({ default: { findOne: mocks.postFindOne } }));
vi.mock("../../../../models/GroupComment", () => ({
    default: { create: mocks.commentCreate, deleteOne: mocks.commentDeleteOne },
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ id: GROUP }) };

function request(method: string, body: unknown) {
    const next = new NextRequest(`https://example.test/api/groups/${GROUP}/comments`, {
        method,
        headers: { origin: "https://example.test", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    next.user = { _id: "user-1" };
    return next;
}

describe("group comments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.loadMembership.mockResolvedValue({ role: "member", group: {} });
        mocks.postFindOne.mockReturnValue({
            select: () => ({
                lean: () =>
                    Promise.resolve({ highlights: [{ _id: { toString: () => HIGHLIGHT } }] }),
            }),
        });
        mocks.commentCreate.mockResolvedValue({ _id: { toString: () => "c1" } });
        mocks.commentDeleteOne.mockResolvedValue({ deletedCount: 1 });
    });

    it("replies to a highlight in the post", async () => {
        const response = await POST(
            request("POST", { postId: POST_ID, highlightId: HIGHLIGHT, body: " Nice catch " }),
            context,
        );
        expect(response.status).toBe(201);
        expect(mocks.commentCreate).toHaveBeenCalledWith(
            expect.objectContaining({ highlightID: HIGHLIGHT, body: "Nice catch" }),
        );
    });

    it("refuses a highlight that isn't in the post", async () => {
        const response = await POST(
            request("POST", { postId: POST_ID, highlightId: OTHER, body: "Hi" }),
            context,
        );
        expect(response.status).toBe(400);
        expect(mocks.commentCreate).not.toHaveBeenCalled();
    });

    it("refuses empty comments and non-members", async () => {
        expect((await POST(request("POST", { postId: POST_ID, body: "   " }), context)).status).toBe(400);
        mocks.loadMembership.mockResolvedValue(null);
        expect((await POST(request("POST", { postId: POST_ID, body: "Hi" }), context)).status).toBe(404);
    });

    it("lets members delete only their own comments", async () => {
        await DELETE(request("DELETE", { commentId: "64b0000000000000000000e1" }), context);
        expect(mocks.commentDeleteOne).toHaveBeenCalledWith(
            expect.objectContaining({ authorID: "user-1", groupID: GROUP }),
        );
    });

    it("lets the owner delete any comment in the group", async () => {
        mocks.loadMembership.mockResolvedValue({ role: "owner", group: {} });
        await DELETE(request("DELETE", { commentId: "64b0000000000000000000e1" }), context);
        const filter = mocks.commentDeleteOne.mock.calls[0][0];
        expect(filter).not.toHaveProperty("authorID");
        expect(filter.groupID).toBe(GROUP);
    });
});
