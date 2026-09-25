import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    save: vi.fn(async (user: unknown) => user),
    connectDB: vi.fn(),
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.4"),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../db/connectDB", () => ({
    default: mocks.connectDB,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));
vi.mock("../../models/User", () => {
    class User {
        _id = { toString: () => "507f1f77bcf86cd799439011" };
        submittedAt = new Date("2026-01-02T00:00:00.000Z");
        tokenVersion = 0;
        firstName = "";
        lastName = "";
        email = "";
        password = "";

        constructor(data: Record<string, string>) {
            Object.assign(this, data);
        }

        save() {
            return mocks.save(this);
        }

        static findOne(...args: unknown[]) {
            return mocks.findOne(...args);
        }
    }
    return { default: User };
});

import { POST } from "./route";

const SECRET = "signup-test-secret";
const originalSecret = process.env.JWT_SECRET;

function signupRequest(
    fields: Record<string, string> | null,
    headers: Record<string, string> = { origin: "https://example.test" },
) {
    const form = new FormData();
    if (fields) {
        for (const [key, value] of Object.entries(fields)) {
            form.set(key, value);
        }
    }
    return new NextRequest("https://example.test/api/signup", {
        method: "POST",
        headers,
        body: fields ? form : undefined,
    });
}

const validFields = {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "  Ada@Example.com ",
    password: "correct horse",
};

describe("POST /api/signup", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = SECRET;
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 2,
            retryAfterSeconds: 60,
        });
        mocks.findOne.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.JWT_SECRET = originalSecret;
    });

    it("rejects a cross-origin signup before rate limiting", async () => {
        const response = await POST(
            signupRequest(validFields, { origin: "https://evil.example" }),
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.success).toBe(false);
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    });

    it("rejects an oversized body", async () => {
        const response = await POST(
            signupRequest(validFields, {
                origin: "https://example.test",
                "content-length": String(33 * 1024),
            }),
        );

        expect(response.status).toBe(413);
        expect(mocks.connectDB).not.toHaveBeenCalled();
    });

    it("rejects repeated signup attempts from the same IP", async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 90,
        });

        const response = await POST(signupRequest(validFields));

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("90");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
            scope: "signup",
            identity: "203.0.113.4",
            limit: 3,
            windowMs: 60 * 60_000,
        });
        expect(mocks.connectDB).not.toHaveBeenCalled();
    });

    it("rejects missing or oversized fields", async () => {
        const missing = await POST(
            signupRequest({
                first_name: "Ada",
                last_name: "Lovelace",
                email: "ada@example.com",
                password: "   ",
            }),
        );
        expect(missing.status).toBe(400);
        expect(mocks.findOne).not.toHaveBeenCalled();

        const huge = await POST(
            signupRequest({ ...validFields, first_name: "A".repeat(101) }),
        );
        expect(huge.status).toBe(400);
    });

    it("rejects an email that is already registered", async () => {
        mocks.findOne.mockResolvedValue({ _id: "existing" });

        const response = await POST(signupRequest(validFields));
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe("Email already registered.");
        expect(mocks.findOne).toHaveBeenCalledWith({
            email: "ada@example.com",
        });
        expect(mocks.save).not.toHaveBeenCalled();
    });

    it("creates the account and sets an auth cookie without returning the password", async () => {
        const response = await POST(signupRequest(validFields));
        const body = await response.json();
        const setCookie = response.headers.get("set-cookie") ?? "";
        const token = setCookie.match(/auth_token=([^;]+)/)?.[1];
        const payload = jwt.verify(decodeURIComponent(token ?? ""), SECRET);

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.email).toBe("ada@example.com");
        expect(body.data.password).toBeUndefined();
        expect(payload).toEqual(
            expect.objectContaining({
                id: "507f1f77bcf86cd799439011",
                email: "ada@example.com",
                tokenVersion: 0,
            }),
        );
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("SameSite=strict");
        expect(mocks.save).toHaveBeenCalled();
    });

    it("returns 500 when the account cannot be saved", async () => {
        mocks.save.mockRejectedValueOnce(new Error("db down"));

        const response = await POST(signupRequest(validFields));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({
            success: false,
            error: "Internal server error",
        });
    });
});
