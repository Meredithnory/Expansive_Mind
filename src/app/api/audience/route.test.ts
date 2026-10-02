import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ updateOne: vi.fn(), updateMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({ withOptionalAuth: (handler: unknown) => handler }));
vi.mock("../../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: () => Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
    requestIp: () => "1.2.3.4",
}));
vi.mock("../../lib/request-security", async (original) => ({
    ...(await original<typeof import("../../lib/request-security")>()),
    hasValidMutationOrigin: () => true,
}));
vi.mock("../../models/PageEngagement", () => ({
    default: { updateOne: mocks.updateOne, updateMany: mocks.updateMany },
}));

import { POST } from "./route";

function request(body: unknown) {
    return new NextRequest("https://expansivemind.ai/api/audience", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: "em_audience=0123456789abcdef0123456789abcdef",
        },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.RATE_LIMIT_SECRET = "test-secret";
});

describe("POST /api/audience presence", () => {
    it("adds time and marks where the visitor is now", async () => {
        await POST(request({ page: "home", seconds: 12, next: "discover" }));
        const [, update, options] = mocks.updateOne.mock.calls[0];
        expect(update.$inc).toEqual({ "secondsByPage.home": 12, "moves.home__discover": 1 });
        expect(update.$set).toMatchObject({ lastPage: "discover", away: false });
        expect(update.$set.lastSeenAt).toBeInstanceOf(Date);
        expect(options).toEqual({ upsert: true });
    });

    it("marks a hidden tab away without counting a new visit", async () => {
        await POST(request({ page: "discover", seconds: 0, away: true }));
        const [, update, options] = mocks.updateOne.mock.calls[0];
        expect(update).toEqual({ $set: expect.objectContaining({ lastPage: "discover", away: true }) });
        expect(options).toBeUndefined();
    });

    it("does nothing for an empty report", async () => {
        await POST(request({ page: "discover", seconds: 0 }));
        expect(mocks.updateOne).not.toHaveBeenCalled();
    });
});
