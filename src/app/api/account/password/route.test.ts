import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
}));

import { POST } from "./route";

const hash = bcrypt.hashSync("current-secret", 4);

function user() {
    return {
        _id: { toString: () => "user-1" },
        password: hash,
        tokenVersion: 2,
        passwordResetTokenHash: "pending-reset",
        passwordResetExpiresAt: new Date("2026-09-25T00:00:00.000Z"),
        save: vi.fn().mockResolvedValue(undefined),
    };
}

function request(body: unknown, origin = "https://example.test") {
    const next = new NextRequest("https://example.test/api/account/password", {
        method: "POST",
        headers: {
            origin,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
    next.user = user();
    return next;
}

describe("POST /api/account/password", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfterSeconds: 10,
        });
    });

    it("rejects a cross-origin password change", async () => {
        const response = await POST(
            request(
                { currentPassword: "current-secret", newPassword: "new-secret" },
                "https://evil.example",
            ),
        );

        expect(response.status).toBe(403);
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    });

    it("rate-limits repeated attempts", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 45,
        });

        const response = await POST(
            request({
                currentPassword: "current-secret",
                newPassword: "new-secret",
            }),
        );

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("45");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "password-change",
            identity: "user-1",
            limit: 5,
            windowMs: 60 * 60 * 1_000,
        });
    });

    it("rejects a short new password and a wrong current password", async () => {
        const short = await POST(
            request({ currentPassword: "current-secret", newPassword: "short" }),
        );
        expect(short.status).toBe(400);
        expect(await short.json()).toEqual({
            error: "Use a new password between 6 and 128 characters.",
        });

        const wrong = request({
            currentPassword: "not-the-password",
            newPassword: "new-secret",
        });
        const response = await POST(wrong);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: "That current password doesn't match.",
        });
        expect(wrong.user.save).not.toHaveBeenCalled();
        expect(wrong.user.tokenVersion).toBe(2);
    });

    it("saves the new password, bumps tokenVersion, and clears the auth cookie", async () => {
        const next = request({
            currentPassword: "current-secret",
            newPassword: "  new-secret  ",
        });
        const response = await POST(next);
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            message: "Password updated. You're logged out everywhere.",
        });
        expect(next.user.password).toBe("new-secret");
        expect(next.user.tokenVersion).toBe(3);
        expect(next.user.passwordResetTokenHash).toBeNull();
        expect(next.user.passwordResetExpiresAt).toBeNull();
        expect(next.user.save).toHaveBeenCalled();
        expect(setCookie).toContain("auth_token=");
        expect(setCookie).toMatch(/Max-Age=0/i);
    });
});
