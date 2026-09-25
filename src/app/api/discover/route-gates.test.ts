import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseFounderReport } from "../../lib/founder-report";

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.8"),
    consumeQuota: vi.fn(),
    refundQuota: vi.fn(),
    getQuotaSnapshot: vi.fn(),
    resolvePlan: vi.fn(),
    isAdminUser: vi.fn(),
    consumeGuestDailyCap: vi.fn(),
    cached: vi.fn(),
    getCachedValue: vi.fn(),
    setCachedValue: vi.fn(),
    deferUsageRecording: vi.fn(),
    runDiscoverAgent: vi.fn(),
    retrieveFounderSources: vi.fn(),
    buildFounderReport: vi.fn(),
    findDiscoveries: vi.fn(),
    createDiscovery: vi.fn(),
    deleteDiscovery: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
    withOptionalAuth: (handler: (req: NextRequest) => Promise<Response>) =>
        handler,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));
vi.mock("../../lib/entitlements", () => ({
    consumeQuota: mocks.consumeQuota,
    refundQuota: mocks.refundQuota,
    getQuotaSnapshot: mocks.getQuotaSnapshot,
    resolvePlan: mocks.resolvePlan,
}));
vi.mock("../../lib/admin", () => ({
    isAdminUser: mocks.isAdminUser,
}));
vi.mock("../../lib/guest-cost-cap", () => ({
    consumeGuestDailyCap: mocks.consumeGuestDailyCap,
}));
vi.mock("../../lib/provider-cache", () => ({
    cached: mocks.cached,
    getCachedValue: mocks.getCachedValue,
    setCachedValue: mocks.setCachedValue,
}));
vi.mock("../../lib/usage-meter", () => ({
    deferUsageRecording: mocks.deferUsageRecording,
}));
vi.mock("./agent", () => ({
    runDiscoverAgent: mocks.runDiscoverAgent,
    DiscoverAgentError: class DiscoverAgentError extends Error {
        status: number;
        constructor(message: string, status = 400) {
            super(message);
            this.status = status;
        }
    },
}));
vi.mock("./founder-diligence", () => ({
    retrieveFounderSources: mocks.retrieveFounderSources,
    buildFounderReport: mocks.buildFounderReport,
}));
vi.mock("../../models/SavedDiscovery", () => ({
    default: {
        find: mocks.findDiscoveries,
        create: mocks.createDiscovery,
        findOneAndDelete: mocks.deleteDiscovery,
    },
}));

import { DELETE, GET, POST } from "./route";
import { DiscoverAgentError } from "./agent";

const userId = { toString: () => "user-1" };
const quotas = {
    discover: { limit: 1, used: 0, remaining: 1 },
};

function post(body: unknown, user?: Record<string, unknown>, origin = "https://example.test") {
    const request = new NextRequest("https://example.test/api/discover", {
        method: "POST",
        headers: {
            origin,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (user) request.user = user;
    return request;
}

describe("discover route gates", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        mocks.resolvePlan.mockImplementation((user?: unknown) =>
            user ? "free" : "guest",
        );
        mocks.isAdminUser.mockReturnValue(false);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 1,
            retryAfterSeconds: 30,
        });
        mocks.consumeGuestDailyCap.mockResolvedValue({
            allowed: true,
            retryAfterSeconds: 60,
        });
        mocks.consumeQuota.mockResolvedValue({
            allowed: true,
            limit: 1,
            used: 1,
            remaining: 0,
        });
        mocks.refundQuota.mockResolvedValue(undefined);
        mocks.getQuotaSnapshot.mockResolvedValue(quotas);
        mocks.getCachedValue.mockResolvedValue(null);
        mocks.retrieveFounderSources.mockResolvedValue({
            sources: [],
            limitations: [],
        });
        mocks.buildFounderReport.mockResolvedValue(
            parseFounderReport({
                version: 1,
                scope: "",
                sources: [],
                areas: [],
                options: [],
            }),
        );
        mocks.runDiscoverAgent.mockResolvedValue({
            question: "Why did events fall?",
            brief: "Events fell.",
            papers: [],
            extractions: [],
            meta: {},
        });
        mocks.cached.mockImplementation(
            async ({ load }: { load: () => Promise<unknown> }) => ({
                value: await load(),
                cacheHit: false,
            }),
        );
    });

    it("returns the last guest discovery without reading the library", async () => {
        const cachedDiscovery = { id: "guest-1", question: "Why?" };
        mocks.getCachedValue.mockResolvedValue(cachedDiscovery);

        const response = await GET(
            new NextRequest("https://example.test/api/discover"),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.discoveries).toEqual([cachedDiscovery]);
        expect(body.plan).toBe("guest");
        expect(body.quota).toEqual(quotas.discover);
        expect(mocks.getCachedValue).toHaveBeenCalledWith(
            "guest-discovery-last",
            "203.0.113.8",
        );
        expect(mocks.findDiscoveries).not.toHaveBeenCalled();
    });

    it("lists a signed-in library", async () => {
        mocks.findDiscoveries.mockReturnValue({
            sort: () => ({
                limit: () => ({
                    lean: async () => [
                        {
                            _id: { toString: () => "64a1b2c3d4e5f6a7b8c9d0e1" },
                            question: "Why?",
                            brief: "Because.",
                            report: null,
                            papers: [],
                            extractions: [],
                            meta: {},
                            createdAt: new Date("2026-09-01T00:00:00.000Z"),
                        },
                    ],
                }),
            }),
        });
        const request = new NextRequest("https://example.test/api/discover");
        request.user = { _id: userId };

        const body = await (await GET(request)).json();

        expect(body.plan).toBe("free");
        expect(body.discoveries[0].id).toBe("64a1b2c3d4e5f6a7b8c9d0e1");
        expect(mocks.getCachedValue).not.toHaveBeenCalled();
    });

    it("rejects a cross-origin run and a body that is not JSON", async () => {
        const cross = await POST(
            post({ question: "Why?" }, undefined, "https://evil.example"),
        );
        expect(cross.status).toBe(403);
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();

        const bad = new NextRequest("https://example.test/api/discover", {
            method: "POST",
            headers: {
                origin: "https://example.test",
                "content-type": "application/json",
            },
            body: "not-json",
        });
        const response = await POST(bad);
        expect(response.status).toBe(400);
    });

    it("rejects an empty question after the guest rate limit", async () => {
        const response = await POST(post({ question: "   " }));

        expect(response.status).toBe(400);
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "discover",
            identity: "203.0.113.8",
            limit: 2,
            windowMs: 10 * 60 * 1_000,
        });
        expect(mocks.consumeQuota).not.toHaveBeenCalled();
    });

    it("uses the signed-in rate limit and blocks the guest daily cap", async () => {
        const signedIn = post({ question: "Why did events fall?" }, {
            _id: userId,
        });
        mocks.consumeQuota.mockResolvedValueOnce({
            allowed: false,
            limit: 2,
            used: 2,
            remaining: 0,
        });
        const limited = await POST(signedIn);
        expect(limited.status).toBe(429);
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
            expect.objectContaining({ identity: "user-1", limit: 5 }),
        );

        mocks.consumeGuestDailyCap.mockResolvedValue({
            allowed: false,
            retryAfterSeconds: 80,
        });
        const guest = await POST(post({ question: "Why did events fall?" }));
        const body = await guest.json();
        expect(guest.status).toBe(429);
        expect(guest.headers.get("retry-after")).toBe("80");
        expect(body.code).toBe("DAILY_CAP_REACHED");
    });

    it("returns the guest and free quota messages", async () => {
        mocks.consumeQuota.mockResolvedValue({
            allowed: false,
            limit: 1,
            used: 1,
            remaining: 0,
        });

        const guest = await POST(post({ question: "Why did events fall?" }));
        expect((await guest.json()).error).toContain("free Discovery preview");

        const free = await POST(
            post({ question: "Why did events fall?" }, { _id: userId }),
        );
        expect((await free.json()).error).toContain("two free Discovery runs");
        expect(mocks.runDiscoverAgent).not.toHaveBeenCalled();
    });

    it("refunds quota when the run has no papers", async () => {
        mocks.runDiscoverAgent.mockResolvedValue({
            question: "Why did events fall?",
            brief: "No papers.",
            papers: [],
            noResults: true,
            meta: {},
        });

        const response = await POST(
            post({ question: "Why did events fall?" }, { _id: userId }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.id).toMatch(/^empty-\d+$/);
        expect(mocks.refundQuota).toHaveBeenCalledWith({
            plan: "free",
            feature: "discover",
            identity: "user-1",
        });
        expect(mocks.createDiscovery).not.toHaveBeenCalled();
    });

    it("refunds quota when the agent rejects the question", async () => {
        mocks.runDiscoverAgent.mockRejectedValue(
            new DiscoverAgentError("That question is too vague.", 422),
        );

        const response = await POST(post({ question: "Why did events fall?" }));
        const body = await response.json();

        expect(response.status).toBe(422);
        expect(body.error).toBe("That question is too vague.");
        expect(mocks.refundQuota).toHaveBeenCalledWith({
            plan: "guest",
            feature: "discover",
            identity: "203.0.113.8",
        });
    });

    it("stores a guest result and a signed-in discovery", async () => {
        const guest = await POST(post({ question: "Why did events fall?" }));
        const guestBody = await guest.json();
        expect(guest.status).toBe(200);
        expect(guestBody.id).toMatch(/^guest-\d+$/);
        expect(mocks.setCachedValue).toHaveBeenCalledWith(
            "guest-discovery-last",
            "203.0.113.8",
            expect.objectContaining({ id: guestBody.id }),
            24 * 60 * 60,
        );
        expect(mocks.createDiscovery).not.toHaveBeenCalled();

        mocks.createDiscovery.mockResolvedValue({
            _id: { toString: () => "64a1b2c3d4e5f6a7b8c9d0e1" },
            createdAt: new Date("2026-09-01T00:00:00.000Z"),
        });
        const saved = await POST(
            post({ question: "Why did events fall?" }, { _id: userId }),
        );
        const savedBody = await saved.json();
        expect(savedBody.id).toBe("64a1b2c3d4e5f6a7b8c9d0e1");
        expect(mocks.createDiscovery).toHaveBeenCalledWith(
            expect.objectContaining({
                userID: userId,
                question: "Why did events fall?",
            }),
        );
    });

    it("deletes only the caller's discovery", async () => {
        const badOrigin = new NextRequest("https://example.test/api/discover", {
            method: "DELETE",
            headers: { origin: "https://evil.example" },
            body: JSON.stringify({ id: "64a1b2c3d4e5f6a7b8c9d0e1" }),
        });
        badOrigin.user = { _id: userId };
        expect((await DELETE(badOrigin)).status).toBe(403);

        const badId = new NextRequest("https://example.test/api/discover", {
            method: "DELETE",
            headers: {
                origin: "https://example.test",
                "content-type": "application/json",
            },
            body: JSON.stringify({ id: "nope" }),
        });
        badId.user = { _id: userId };
        expect((await DELETE(badId)).status).toBe(400);
        expect(mocks.deleteDiscovery).not.toHaveBeenCalled();

        mocks.deleteDiscovery.mockResolvedValueOnce(null);
        const missing = new NextRequest("https://example.test/api/discover", {
            method: "DELETE",
            headers: {
                origin: "https://example.test",
                "content-type": "application/json",
            },
            body: JSON.stringify({ id: "64a1b2c3d4e5f6a7b8c9d0e1" }),
        });
        missing.user = { _id: userId };
        expect((await DELETE(missing)).status).toBe(404);

        mocks.deleteDiscovery.mockResolvedValueOnce({ _id: "64a1b2c3d4e5f6a7b8c9d0e1" });
        const gone = new NextRequest("https://example.test/api/discover", {
            method: "DELETE",
            headers: {
                origin: "https://example.test",
                "content-type": "application/json",
            },
            body: JSON.stringify({ id: "64a1b2c3d4e5f6a7b8c9d0e1" }),
        });
        gone.user = { _id: userId };
        expect((await DELETE(gone)).status).toBe(200);
        expect(mocks.deleteDiscovery).toHaveBeenCalledWith({
            _id: "64a1b2c3d4e5f6a7b8c9d0e1",
            userID: userId,
        });
    });
});
