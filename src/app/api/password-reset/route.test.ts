import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
    PASSWORD_RESET_REQUEST_MESSAGE,
    PASSWORD_RESET_TTL_MS,
    hashPasswordResetToken,
} from "../../lib/password-reset";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    connectDB: vi.fn(),
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.8"),
    sendPasswordResetEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../db/connectDB", () => ({
    default: mocks.connectDB,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));
vi.mock("../../lib/password-reset-mail", () => ({
    sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));
vi.mock("../../models/User", () => ({
    default: {
        findOne: (...args: unknown[]) => mocks.findOne(...args),
    },
}));

import { POST } from "./route";

const originalKey = process.env.RESEND_API_KEY;

function request(body: unknown, origin = "https://example.test") {
    return new NextRequest("https://example.test/api/password-reset", {
        method: "POST",
        headers: {
            origin,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

function user() {
    return {
        email: "ada@example.com",
        passwordResetTokenHash: null as string | null,
        passwordResetExpiresAt: null as Date | null,
        save: vi.fn().mockResolvedValue(undefined),
    };
}

describe("POST /api/password-reset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        process.env.RESEND_API_KEY = "test-key";
        delete process.env.APP_URL;
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 4,
            retryAfterSeconds: 30,
        });
        mocks.sendPasswordResetEmail.mockResolvedValue({
            accepted: true,
            status: 200,
            id: "email_1",
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalKey === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = originalKey;
    });

    it("rejects a cross-origin request before rate limiting", async () => {
        const response = await POST(
            request({ email: "ada@example.com" }, "https://evil.example"),
        );

        expect(response.status).toBe(403);
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    });

    it("rate-limits by IP and by email", async () => {
        mocks.consumeRateLimit.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 45,
        });

        const limited = await POST(request({ email: "ada@example.com" }));
        expect(limited.status).toBe(429);
        expect(limited.headers.get("retry-after")).toBe("45");
        expect(mocks.findOne).not.toHaveBeenCalled();

        mocks.consumeRateLimit
            .mockResolvedValueOnce({
                allowed: true,
                remaining: 4,
                retryAfterSeconds: 30,
            })
            .mockResolvedValueOnce({
                allowed: false,
                remaining: 0,
                retryAfterSeconds: 90,
            });
        const emailLimited = await POST(request({ email: "Ada@Example.com" }));
        expect(emailLimited.status).toBe(429);
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "password-reset-email",
            identity: "ada@example.com",
            limit: 3,
            windowMs: 60 * 60_000,
        });
    });

    it("rejects an invalid email without saying whether it is registered", async () => {
        const response = await POST(request({ email: "not-an-email" }));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            success: false,
            message: "Please use a valid email.",
        });
        expect(mocks.findOne).not.toHaveBeenCalled();
    });

    it("does not pretend to send when Resend is not configured", async () => {
        delete process.env.RESEND_API_KEY;
        const response = await POST(request({ email: "ada@example.com" }));
        expect(response.status).toBe(503);
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("returns the same success message when no account exists and does not send", async () => {
        mocks.findOne.mockResolvedValue(null);
        const response = await POST(request({ email: "missing@example.com" }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            message: PASSWORD_RESET_REQUEST_MESSAGE,
        });
        expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("emails one expiring link and stores only the token hash", async () => {
        const account = user();
        mocks.findOne.mockResolvedValue(account);
        const before = Date.now();
        const response = await POST(request({ email: "  Ada@Example.com " }));
        const after = Date.now();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            message: PASSWORD_RESET_REQUEST_MESSAGE,
        });
        expect(mocks.findOne).toHaveBeenCalledWith({
            email: "ada@example.com",
        });
        expect(mocks.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        const sent = mocks.sendPasswordResetEmail.mock.calls[0][0] as {
            to: string;
            link: string;
        };
        expect(sent.to).toBe("ada@example.com");
        const token = new URL(sent.link).searchParams.get("token") ?? "";
        expect(sent.link.startsWith("https://example.test/reset-password?token=")).toBe(true);
        expect(account.passwordResetTokenHash).toBe(hashPasswordResetToken(token));
        expect(account.passwordResetTokenHash).not.toBe(token);
        const expires = account.passwordResetExpiresAt?.getTime() ?? 0;
        expect(expires).toBeGreaterThanOrEqual(before + PASSWORD_RESET_TTL_MS);
        expect(expires).toBeLessThanOrEqual(after + PASSWORD_RESET_TTL_MS);
        expect(account.save).toHaveBeenCalledTimes(1);
    });

    it("clears the token when the provider does not accept the email", async () => {
        const account = user();
        mocks.findOne.mockResolvedValue(account);
        mocks.sendPasswordResetEmail.mockResolvedValue({
            accepted: false,
            status: 422,
            id: null,
        });

        const response = await POST(request({ email: "ada@example.com" }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            message: PASSWORD_RESET_REQUEST_MESSAGE,
        });
        expect(account.passwordResetTokenHash).toBeNull();
        expect(account.passwordResetExpiresAt).toBeNull();
        expect(account.save).toHaveBeenCalledTimes(2);
    });
});
