import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    suggestSearchQuery: vi.fn(),
    getCombinedSearchTotalCount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("../utils", () => ({
    getCombinedSearchTotalCount: mocks.getCombinedSearchTotalCount,
}));
vi.mock("../spell-suggest", () => ({
    suggestSearchQuery: mocks.suggestSearchQuery,
    queriesMatch: (left: string, right: string) =>
        left.trim().toLowerCase().replace(/\s+/g, " ") ===
        right.trim().toLowerCase().replace(/\s+/g, " "),
}));

import { GET } from "./route";

function request(query: string) {
    const next = new NextRequest(
        `https://example.test/api/search/suggest?${query}`,
    );
    next.user = { _id: { toString: () => "user-1" } };
    return next;
}

describe("GET /api/search/suggest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 9,
            retryAfterSeconds: 8,
        });
        mocks.suggestSearchQuery.mockResolvedValue("protein kinase");
        mocks.getCombinedSearchTotalCount.mockResolvedValue(14);
    });

    it("rate-limits suggestion lookups", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 8,
        });

        const response = await GET(request("q=protien"));

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("8");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "search-suggest",
            identity: "user-1",
            limit: 10,
            windowMs: 10 * 60_000,
        });
        expect(mocks.suggestSearchQuery).not.toHaveBeenCalled();
    });

    it("rejects a missing or oversized query", async () => {
        expect((await GET(request(""))).status).toBe(400);
        expect((await GET(request(`q=${"a".repeat(301)}`))).status).toBe(400);
        expect(mocks.suggestSearchQuery).not.toHaveBeenCalled();
    });

    it("returns no suggestion when the spelling matches the query", async () => {
        mocks.suggestSearchQuery.mockResolvedValue("protein kinase");

        const response = await GET(request("q=Protein%20%20Kinase"));
        const body = await response.json();

        expect(body).toEqual({
            originalQuery: "Protein  Kinase",
            suggestedQuery: null,
            suggestedTotalCount: 0,
        });
        expect(mocks.getCombinedSearchTotalCount).not.toHaveBeenCalled();
    });

    it("counts hits for a corrected query and treats an unknown source as all", async () => {
        const response = await GET(request("q=protien&source=not-a-source"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            originalQuery: "protien",
            suggestedQuery: "protein kinase",
            suggestedTotalCount: 14,
        });
        expect(mocks.getCombinedSearchTotalCount).toHaveBeenCalledWith(
            "protein kinase",
            "all",
        );
    });

    it("returns 500 when suggestion lookup throws", async () => {
        mocks.suggestSearchQuery.mockRejectedValue(new Error("nih down"));

        const response = await GET(request("q=protien"));

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            error: "Failed to suggest search query",
        });
    });
});
