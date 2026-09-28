import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
    createPasswordResetToken,
    hashPasswordResetToken,
} from "../../../lib/password-reset";

const mocks = vi.hoisted(() => ({
    findOneAndUpdate: vi.fn(),
    connectDB: vi.fn(),
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.8"),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../db/connectDB", () => ({
    default: mocks.connectDB,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));
vi.mock("../../../models/User", () => ({
    default: {
        findOneAndUpdate: (...args: unknown[]) => mocks.findOneAndUpdate(...args),
    },
}));

import { POST } from "./route";

function request(body: unknown, origin = "https://example.test") {
    return new NextRequest("https://example.test/api/password-reset/confirm", {
        method: "POST",
        headers: {
            origin,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

function claimedUser() {
    return {
        password: "old-hash",
        tokenVersion: 2,
        save: vi.fn().mockResolvedValue(undefined),
    };
}

describe("POST /api/password-reset/confirm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 9,
            retryAfterSeconds: 20,
        });
    });

    it("rejects a cross-origin confirm", async () => {
        const token = createPasswordResetToken();
        const response = await POST(
            request(
                { token, password: "new-secret" },
                "https://evil.example",
            ),
        );
        expect(response.status).toBe(403);
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    });

    it("rate-limits repeated confirms", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 45,
        });
        const response = await POST(
            request({
                token: createPasswordResetToken(),
                password: "new-secret",
            }),
        );
        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("45");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "password-reset-confirm",
            identity: "203.0.113.8",
            limit: 10,
            windowMs: 15 * 60_000,
        });
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects a short password without consuming the link", async () => {
        const response = await POST(
            request({
                token: createPasswordResetToken(),
                password: "short",
            }),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            success: false,
            message: "Use a new password between 6 and 128 characters.",
        });
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects a used or expired link", async () => {
        mocks.findOneAndUpdate.mockResolvedValue(null);
        const token = createPasswordResetToken();
        const response = await POST(
            request({ token, password: "new-secret" }),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            success: false,
            message: "This reset link is invalid or has expired.",
        });
        const [filter, update] = mocks.findOneAndUpdate.mock.calls[0];
        expect(filter.passwordResetTokenHash).toBe(hashPasswordResetToken(token));
        expect(filter.passwordResetTokenHash).not.toBe(token);
        expect(update).toEqual({
            $unset: {
                passwordResetTokenHash: 1,
                passwordResetExpiresAt: 1,
            },
        });
    });

    it("saves the new password, bumps tokenVersion, and clears the auth cookie", async () => {
        const token = createPasswordResetToken();
        const account = claimedUser();
        mocks.findOneAndUpdate.mockResolvedValue(account);

        const response = await POST(
            request({ token, password: "  new-secret  " }),
        );
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            message: "Password updated. Log in with your new password.",
        });
        expect(account.password).toBe("new-secret");
        expect(account.tokenVersion).toBe(3);
        expect(account.save).toHaveBeenCalledTimes(1);
        expect(setCookie).toContain("auth_token=");
        expect(setCookie).toMatch(/Max-Age=0/i);
    });
});
