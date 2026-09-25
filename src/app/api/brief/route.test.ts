import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    findBrief: vi.fn(),
    upsertBrief: vi.fn(),
    loadCachedPaperBySource: vi.fn(),
    consumeRateLimit: vi.fn(),
    consumeQuota: vi.fn(),
    refundQuota: vi.fn(),
    resolvePlan: vi.fn(),
    isAdminUser: vi.fn(),
    synthesizePaperBrief: vi.fn(),
    generateShareSlug: vi.fn(() => "briefSlug1234"),
}));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../models/PaperBrief", () => ({
    default: {
        findOne: mocks.findBrief,
        findOneAndUpdate: mocks.upsertBrief,
    },
}));
vi.mock("../paper/load-paper", () => ({
    loadCachedPaperBySource: mocks.loadCachedPaperBySource,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("../../lib/entitlements", () => ({
    consumeQuota: mocks.consumeQuota,
    refundQuota: mocks.refundQuota,
    resolvePlan: mocks.resolvePlan,
}));
vi.mock("../../lib/admin", () => ({
    isAdminUser: mocks.isAdminUser,
}));
vi.mock("../../lib/share-slug", () => ({
    generateShareSlug: mocks.generateShareSlug,
}));
vi.mock("./synthesize-brief", () => ({
    synthesizePaperBrief: mocks.synthesizePaperBrief,
}));

import { GET, POST } from "./route";

const userId = { toString: () => "user-1" };

function withUser(request: NextRequest) {
    request.user = { _id: userId };
    return request;
}

function getRequest(query: string) {
    return withUser(
        new NextRequest(`https://example.test/api/brief?${query}`),
    );
}

function postRequest(body: unknown, origin = "https://example.test") {
    return withUser(
        new NextRequest("https://example.test/api/brief", {
            method: "POST",
            headers: {
                origin,
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        }),
    );
}

const paper = {
    title: "Events fell",
    authors: ["Ada Lovelace", "Alan Turing"],
    primarySource: "Springer Nature",
    publicationDate: "2024",
    access: {
        canSendToAI: true,
        canPersistContent: true,
        canonicalUrl: "https://doi.org/10.1/one",
        policyReason: "ok",
    },
};

describe("paper brief route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfterSeconds: 20,
        });
        mocks.resolvePlan.mockReturnValue("free");
        mocks.isAdminUser.mockReturnValue(false);
        mocks.consumeQuota.mockResolvedValue({
            allowed: true,
            limit: 20,
            used: 1,
            remaining: 19,
        });
        mocks.refundQuota.mockResolvedValue(undefined);
        mocks.loadCachedPaperBySource.mockResolvedValue({ value: paper });
        mocks.synthesizePaperBrief.mockResolvedValue("## TL;DR\nEvents fell.");
        mocks.upsertBrief.mockResolvedValue({
            brief: "## TL;DR\nEvents fell.",
            slug: "briefSlug1234",
            updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        });
    });

    it("rejects a lookup without a real paper reference", async () => {
        const response = await GET(getRequest("database=nope&paperId=10.1/one"));

        expect(response.status).toBe(400);
        expect(mocks.findBrief).not.toHaveBeenCalled();
    });

    it("normalizes a PMC id and returns the saved brief", async () => {
        mocks.findBrief.mockReturnValue({
            lean: async () => ({
                brief: "Saved.",
                slug: "briefSlug1234",
                updatedAt: new Date("2026-09-01T00:00:00.000Z"),
            }),
        });

        const response = await GET(
            getRequest("database=nih&paperId=PMC12345"),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.brief.slug).toBe("briefSlug1234");
        expect(mocks.findBrief).toHaveBeenCalledWith({
            userID: userId,
            database: "nih",
            paperId: "12345",
        });
    });

    it("returns null when the caller has no brief yet", async () => {
        mocks.findBrief.mockReturnValue({ lean: async () => null });

        const body = await (
            await GET(getRequest("database=springer&paperId=10.1/one"))
        ).json();

        expect(body.brief).toBeNull();
    });

    it("rejects a cross-origin generation before spending quota", async () => {
        const response = await POST(
            postRequest(
                { database: "springer", paperId: "10.1/one" },
                "https://evil.example",
            ),
        );

        expect(response.status).toBe(403);
        expect(mocks.consumeQuota).not.toHaveBeenCalled();
    });

    it("rate-limits brief generation", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 15,
        });

        const response = await POST(
            postRequest({ database: "springer", paperId: "10.1/one" }),
        );

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("15");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "brief",
            identity: "user-1",
            limit: 5,
            windowMs: 10 * 60 * 1_000,
        });
        expect(mocks.consumeQuota).not.toHaveBeenCalled();
    });

    it("uses the free-plan quota message", async () => {
        mocks.consumeQuota.mockResolvedValue({
            allowed: false,
            limit: 20,
            used: 20,
            remaining: 0,
        });

        const response = await POST(
            postRequest({ database: "springer", paperId: "10.1/one" }),
        );
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.code).toBe("QUOTA_EXCEEDED");
        expect(body.error).toContain("Upgrade to Researcher Pro");
        expect(mocks.loadCachedPaperBySource).not.toHaveBeenCalled();
    });

    it("returns 404 without refunding when the paper is missing", async () => {
        mocks.loadCachedPaperBySource.mockResolvedValue({ value: null });

        const response = await POST(
            postRequest({ database: "springer", paperId: "10.1/one" }),
        );

        expect(response.status).toBe(404);
        expect(mocks.synthesizePaperBrief).not.toHaveBeenCalled();
        expect(mocks.refundQuota).not.toHaveBeenCalled();
    });

    it("refuses a paper the license will not send to the model", async () => {
        mocks.loadCachedPaperBySource.mockResolvedValue({
            value: {
                ...paper,
                access: {
                    ...paper.access,
                    canSendToAI: false,
                    policyReason: "This license does not allow AI use.",
                },
            },
        });

        const response = await POST(
            postRequest({ database: "springer", paperId: "10.1/one" }),
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe("This license does not allow AI use.");
        expect(mocks.synthesizePaperBrief).not.toHaveBeenCalled();
        expect(mocks.refundQuota).not.toHaveBeenCalled();
    });

    it("saves a generated brief and keeps the slug on insert", async () => {
        const response = await POST(
            postRequest({ database: "springer", paperId: " 10.1/one " }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.brief.slug).toBe("briefSlug1234");
        expect(mocks.upsertBrief).toHaveBeenCalledWith(
            expect.objectContaining({
                userID: userId,
                database: "springer",
                paperId: "10.1/one",
            }),
            expect.objectContaining({
                $setOnInsert: expect.objectContaining({
                    slug: "briefSlug1234",
                }),
            }),
            { new: true, upsert: true },
        );
        expect(mocks.refundQuota).not.toHaveBeenCalled();
    });

    it("refunds the chat quota when synthesis throws", async () => {
        mocks.synthesizePaperBrief.mockRejectedValue(new Error("model down"));

        const response = await POST(
            postRequest({ database: "springer", paperId: "10.1/one" }),
        );

        expect(response.status).toBe(500);
        expect(mocks.refundQuota).toHaveBeenCalledWith({
            plan: "free",
            feature: "chat",
            identity: "user-1",
        });
    });
});
