import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    updateOne: vi.fn(),
    limit: vi.fn(),
    origin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({ withOptionalAuth: (handler: unknown) => handler }));
vi.mock("../../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../../lib/rate-limit", () => ({ consumeRateLimit: mocks.limit }));
vi.mock("../../lib/request-security", async (original) => ({
    ...(await original<typeof import("../../lib/request-security")>()),
    hasValidMutationOrigin: mocks.origin,
}));
vi.mock("../../models/Rating", () => ({
    default: { create: mocks.create, updateOne: mocks.updateOne },
}));

import { POST } from "./route";
import { audienceVisitorKey } from "../../lib/audience-visitor";

const TOKEN = "0123456789abcdef0123456789abcdef";
const RATING_ID = "0123456789abcdef01234567";

function request(body: unknown, cookie = `em_audience=${TOKEN}`) {
    return new NextRequest("https://expansivemind.ai/api/ratings", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.RATE_LIMIT_SECRET = "test-secret";
    mocks.origin.mockReturnValue(true);
    mocks.limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.create.mockResolvedValue({ _id: RATING_ID });
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
});

describe("POST /api/ratings", () => {
    it("saves a score with the browser's scrambled key, never the raw cookie", async () => {
        const response = await POST(request({ score: "good", surface: "discover", context: "CAR-T in lupus" }));
        expect(await response.json()).toEqual({ ok: true, id: RATING_ID });
        const saved = mocks.create.mock.calls[0][0];
        expect(saved).toMatchObject({ score: "good", surface: "discover", context: "CAR-T in lupus" });
        expect(saved.visitorKey).toBe(audienceVisitorKey(TOKEN));
        expect(JSON.stringify(saved)).not.toContain(TOKEN);
    });

    it("adds a comment only to this browser's recent, uncommented rating", async () => {
        const response = await POST(request({ id: RATING_ID, comment: "The report missed a 2024 trial." }));
        expect(response.status).toBe(200);
        expect(mocks.create).not.toHaveBeenCalled();
        const [filter, update] = mocks.updateOne.mock.calls[0];
        expect(filter).toMatchObject({
            _id: RATING_ID,
            visitorKey: audienceVisitorKey(TOKEN),
            comment: { $exists: false },
        });
        expect(filter.createdAt.$gte).toBeInstanceOf(Date);
        expect(update).toEqual({ $set: { comment: "The report missed a 2024 trial." } });
    });

    it("refuses a comment for someone else's rating", async () => {
        mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
        const response = await POST(request({ id: RATING_ID, comment: "hi" }));
        expect(response.status).toBe(404);
    });

    it("gives a new visitor the visit cookie", async () => {
        const response = await POST(request({ score: "fine", surface: "paper_chat" }, ""));
        expect(response.status).toBe(200);
        expect(response.cookies.get("em_audience")?.value).toMatch(/^[a-f0-9]{32}$/);
    });

    it("rejects bad scores, other origins, and floods", async () => {
        expect((await POST(request({ score: "great", surface: "discover" }))).status).toBe(400);
        mocks.origin.mockReturnValueOnce(false);
        expect((await POST(request({ score: "good", surface: "discover" }))).status).toBe(403);
        mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
        expect((await POST(request({ score: "good", surface: "discover" }))).status).toBe(429);
        expect(mocks.create).not.toHaveBeenCalled();
    });
});
