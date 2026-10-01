import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ create: vi.fn(), limit: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({ withOptionalAuth: (handler: unknown) => handler }));
vi.mock("../../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../../lib/rate-limit", () => ({ consumeRateLimit: mocks.limit }));
vi.mock("../../lib/request-security", async (original) => ({
    ...(await original<typeof import("../../lib/request-security")>()),
    hasValidMutationOrigin: () => true,
}));
vi.mock("../../models/ActivityEvent", () => ({ default: { create: mocks.create } }));

import { POST } from "./route";
import { audienceVisitorKey } from "../../lib/audience-visitor";

const TOKEN = "0123456789abcdef0123456789abcdef";

function request(body: unknown) {
    return new NextRequest("https://expansivemind.ai/api/activity", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `em_audience=${TOKEN}` },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.RATE_LIMIT_SECRET = "test-secret";
    mocks.limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("POST /api/activity", () => {
    it("records a page view without its query string", async () => {
        const response = await POST(request({ kind: "page_view", path: "/brief/abc?utm=x" }));
        expect(response.status).toBe(200);
        const saved = mocks.create.mock.calls[0][0];
        expect(saved).toMatchObject({
            kind: "page_view",
            page: "brief",
            path: "/brief/abc",
            visitorKey: audienceVisitorKey(TOKEN),
        });
        expect(saved).not.toHaveProperty("detail");
        expect(saved.expiresAt.getTime() - saved.at.getTime()).toBe(30 * 24 * 60 * 60 * 1_000);
    });

    it("records a discovery question", async () => {
        await POST(request({ kind: "discover", detail: "What is known about GLP-1 and addiction?" }));
        expect(mocks.create.mock.calls[0][0]).toMatchObject({
            kind: "discover",
            detail: "What is known about GLP-1 and addiction?",
        });
    });

    it("ignores admin pages and unknown kinds", async () => {
        expect((await POST(request({ kind: "page_view", path: "/admin/live" }))).status).toBe(400);
        expect((await POST(request({ kind: "purchase", detail: "x" }))).status).toBe(400);
        expect(mocks.create).not.toHaveBeenCalled();
    });
});
