import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    updateOne: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("../../../models/User", () => ({
    default: { updateOne: mocks.updateOne },
}));

import { POST } from "./route";

const userId = { toString: () => "user-1" };

function request(origin = "https://example.test") {
    const next = new NextRequest("https://example.test/api/logout/all", {
        method: "POST",
        headers: { origin },
    });
    next.user = { _id: userId };
    return next;
}

describe("POST /api/logout/all", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfterSeconds: 30,
        });
        mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    it("rejects a cross-origin request before bumping the session version", async () => {
        const response = await POST(request("https://evil.example"));

        expect(response.status).toBe(403);
        expect(mocks.updateOne).not.toHaveBeenCalled();
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    });

    it("rate-limits repeated logout-everywhere attempts", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 120,
        });

        const response = await POST(request());

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("120");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "logout-all",
            identity: "user-1",
            limit: 5,
            windowMs: 60 * 60 * 1_000,
        });
        expect(mocks.updateOne).not.toHaveBeenCalled();
    });

    it("increments tokenVersion and clears only the auth cookie", async () => {
        const response = await POST(request());
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            message: "You're logged out everywhere.",
        });
        expect(mocks.updateOne).toHaveBeenCalledWith(
            { _id: userId },
            { $inc: { tokenVersion: 1 } },
        );
        expect(setCookie).toContain("auth_token=");
        expect(setCookie).toMatch(/Max-Age=0/i);
        expect(setCookie).not.toContain("admin_session");
        expect(setCookie).not.toContain("admin_mfa");
    });
});
