import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const TARGET = "64b0000000000000000000f1";
const mocks = vi.hoisted(() => ({
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    reportCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: () => Promise.resolve({ allowed: true }),
}));
vi.mock("../../../models/ForumPost", () => ({
    default: { findById: mocks.findById, findByIdAndUpdate: mocks.findByIdAndUpdate, updateOne: mocks.updateOne },
}));
vi.mock("../../../models/ForumComment", () => ({
    default: { findById: mocks.findById, findByIdAndUpdate: mocks.findByIdAndUpdate, updateOne: mocks.updateOne },
}));
vi.mock("../../../models/ForumReport", () => ({ default: { create: mocks.reportCreate } }));

import { POST } from "./route";

function request(body: unknown) {
    const next = new NextRequest("https://example.test/api/forum/report", {
        method: "POST",
        headers: { origin: "https://example.test", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    next.user = { _id: { toString: () => "reporter" } };
    return next;
}

const lean = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

describe("forum reports", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findById.mockReturnValue(lean({ authorID: { toString: () => "author" }, status: "visible" }));
        mocks.reportCreate.mockResolvedValue({});
    });

    it("hides a post once 3 people report it", async () => {
        mocks.findByIdAndUpdate.mockReturnValue(lean({ reportCount: 3, status: "visible" }));
        const response = await POST(request({ targetType: "post", targetId: TARGET, reason: "spam" }));
        expect(response.status).toBe(200);
        expect(mocks.updateOne).toHaveBeenCalledWith(
            { _id: TARGET, status: "visible" },
            { $set: { status: "hidden" } },
        );
    });

    it("does not hide before the threshold", async () => {
        mocks.findByIdAndUpdate.mockReturnValue(lean({ reportCount: 2, status: "visible" }));
        await POST(request({ targetType: "post", targetId: TARGET, reason: "spam" }));
        expect(mocks.updateOne).not.toHaveBeenCalled();
    });

    it("counts one report per person", async () => {
        mocks.reportCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
        const response = await POST(request({ targetType: "comment", targetId: TARGET, reason: "other" }));
        expect(await response.json()).toMatchObject({ alreadyReported: true });
        expect(mocks.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects reporting your own post and unknown reasons", async () => {
        mocks.findById.mockReturnValue(lean({ authorID: { toString: () => "reporter" }, status: "visible" }));
        expect((await POST(request({ targetType: "post", targetId: TARGET, reason: "spam" }))).status).toBe(400);
        expect((await POST(request({ targetType: "post", targetId: TARGET, reason: "boring" }))).status).toBe(400);
    });
});
