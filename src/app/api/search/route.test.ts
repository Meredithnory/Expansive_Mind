import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.9"),
    consumeQuota: vi.fn(),
    getPlanEntitlements: vi.fn(),
    resolvePlan: vi.fn(),
    isAdminUser: vi.fn(),
    consumeGuestDailyCap: vi.fn(),
    cached: vi.fn(),
    deferUsageRecording: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({
    withOptionalAuth: (handler: (req: NextRequest) => Promise<Response>) =>
        handler,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));
vi.mock("../../lib/entitlements", () => ({
    consumeQuota: mocks.consumeQuota,
    getPlanEntitlements: mocks.getPlanEntitlements,
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
}));
vi.mock("../../lib/usage-meter", () => ({
    deferUsageRecording: mocks.deferUsageRecording,
}));
vi.mock("../../lib/paper-impact-lookup", () => ({
    attachPaperImpact: vi.fn(),
}));
vi.mock("./utils", () => ({
    mergeResultsByTier: vi.fn(),
    searchEuropePmcPapers: vi.fn(),
    searchCrossrefPapers: vi.fn(),
}));
vi.mock("./semantic-rank", () => ({
    rankSearchResults: vi.fn(),
}));
vi.mock("../research/registry", () => ({
    searchHomed: vi.fn(),
}));

import { GET } from "./route";

const searchHit = {
    results: [{ title: "Events fell" }],
    totalCount: 1,
    totalPages: 1,
    warnings: [],
    callCount: 2,
};

function searchRequest(query: string, user?: { _id: { toString(): string } }) {
    const request = new NextRequest(
        `https://example.test/api/search?${query}`,
    );
    if (user) request.user = user;
    return request;
}

describe("GET /api/search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.resolvePlan.mockImplementation((user?: unknown) =>
            user ? "free" : "guest",
        );
        mocks.isAdminUser.mockReturnValue(false);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 5,
            retryAfterSeconds: 12,
        });
        mocks.consumeGuestDailyCap.mockResolvedValue({
            allowed: true,
            retryAfterSeconds: 40,
        });
        mocks.getPlanEntitlements.mockResolvedValue({
            scholar_search: 0,
            search: 10,
        });
        mocks.consumeQuota.mockResolvedValue({
            allowed: true,
            limit: 10,
            used: 1,
            remaining: 9,
        });
        mocks.cached.mockResolvedValue({
            value: searchHit,
            cacheHit: false,
        });
    });

    it("rate-limits guests before reading the query", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 12,
        });

        const response = await GET(searchRequest("q=kinase"));

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("12");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "search",
            identity: "203.0.113.9",
            limit: 6,
            windowMs: 60_000,
        });
        expect(mocks.cached).not.toHaveBeenCalled();
    });

    it("turns a missing query into the search failure response", async () => {
        const response = await GET(searchRequest("page=0"));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe("Search is temporarily unavailable.");
        expect(mocks.cached).not.toHaveBeenCalled();
    });

    it("rejects an unknown source and a page past the cap", async () => {
        expect((await GET(searchRequest("q=kinase&source=pubmed"))).status).toBe(
            400,
        );
        expect((await GET(searchRequest("q=kinase&page=101"))).status).toBe(400);
        expect(mocks.consumeGuestDailyCap).not.toHaveBeenCalled();
    });

    it("stops a guest at the daily cap and at the search quota", async () => {
        mocks.consumeGuestDailyCap.mockResolvedValueOnce({
            allowed: false,
            retryAfterSeconds: 40,
        });
        const capped = await GET(searchRequest("q=kinase"));
        expect((await capped.json()).code).toBe("DAILY_CAP_REACHED");

        mocks.consumeQuota.mockResolvedValueOnce({
            allowed: false,
            limit: 5,
            used: 5,
            remaining: 0,
        });
        const quota = await GET(searchRequest("q=kinase"));
        const body = await quota.json();
        expect(quota.status).toBe(429);
        expect(body.error).toBe("Daily guest search limit reached.");
    });

    it("keeps Scholar behind Researcher Pro", async () => {
        const request = searchRequest("q=kinase&source=scholar", {
            _id: { toString: () => "user-1" },
        });
        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.code).toBe("PRO_REQUIRED");
        expect(mocks.consumeQuota).not.toHaveBeenCalled();
        expect(mocks.consumeGuestDailyCap).not.toHaveBeenCalled();
    });

    it("caches a signed-in Europe PMC search and records a miss", async () => {
        const response = await GET(
            searchRequest("q=Why%20Events&source=europe-pmc&page=0", {
                _id: { toString: () => "user-1" },
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.results).toEqual(searchHit.results);
        expect(body.plan).toBe("free");
        expect(body.cacheHit).toBe(false);
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
            expect.objectContaining({ identity: "user-1", limit: 30 }),
        );
        expect(mocks.cached).toHaveBeenCalledWith(
            expect.objectContaining({
                namespace: "paper-search-v1",
                key: "why events:0:europe-pmc:semantic",
                ttlSeconds: 6 * 60 * 60,
            }),
        );
        expect(mocks.deferUsageRecording).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: "search",
                callCount: 2,
            }),
        );
    });

    it("does not record usage on a cache hit", async () => {
        mocks.cached.mockResolvedValue({
            value: searchHit,
            cacheHit: true,
        });

        await GET(searchRequest("q=kinase"));

        expect(mocks.deferUsageRecording).not.toHaveBeenCalled();
    });
});
