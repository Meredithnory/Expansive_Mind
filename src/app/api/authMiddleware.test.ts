import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
    findById: vi.fn(),
    connectDB: vi.fn(),
}));

vi.mock("../db/connectDB", () => ({
    default: mocks.connectDB,
}));
vi.mock("../models/User", () => ({
    default: { findById: mocks.findById },
}));

import { withAuth, withOptionalAuth } from "./authMiddleware";

const SECRET = "auth-middleware-test-secret";
const originalSecret = process.env.JWT_SECRET;

async function token(payload: Record<string, unknown>) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(SECRET));
}

function request(authToken?: string) {
    return new NextRequest("https://example.test/api/session", {
        headers: authToken ? { cookie: `auth_token=${authToken}` } : undefined,
    });
}

const handler = vi.fn(async (req: NextRequest) =>
    NextResponse.json({
        ok: true,
        email: req.user?.email ?? null,
    }),
);

describe("withAuth and withOptionalAuth", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = SECRET;
        vi.clearAllMocks();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        mocks.connectDB.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.JWT_SECRET = originalSecret;
    });

    it("rejects a request with no cookie", async () => {
        const response = await withAuth(handler)(request());

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
        expect(mocks.findById).not.toHaveBeenCalled();
    });

    it("rejects a bad signature without loading a user", async () => {
        const response = await withAuth(handler)(request("not-a-jwt"));

        expect(response.status).toBe(401);
        expect(mocks.connectDB).not.toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
    });

    it("rejects a token that has no user id", async () => {
        const response = await withAuth(handler)(
            request(await token({ tokenVersion: 0 })),
        );

        expect(response.status).toBe(401);
        expect(mocks.connectDB).not.toHaveBeenCalled();
    });

    it("rejects an unknown user and a revoked token version", async () => {
        mocks.findById.mockResolvedValueOnce(null);
        const missing = await withAuth(handler)(
            request(await token({ id: "user-1", tokenVersion: 0 })),
        );
        expect(missing.status).toBe(401);

        mocks.findById.mockResolvedValueOnce({
            email: "ada@example.com",
            tokenVersion: 2,
        });
        const revoked = await withAuth(handler)(
            request(await token({ id: "user-1", tokenVersion: 1 })),
        );
        expect(revoked.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it("attaches the user when the token version matches", async () => {
        const user = { email: "ada@example.com", tokenVersion: 1 };
        mocks.findById.mockResolvedValue(user);

        const response = await withAuth(handler)(
            request(await token({ id: "user-1", tokenVersion: 1 })),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.email).toBe("ada@example.com");
        expect(mocks.findById).toHaveBeenCalledWith("user-1");
    });

    it("lets optional auth continue when the cookie is missing or invalid", async () => {
        const anonymous = await withOptionalAuth(handler)(request());
        expect(anonymous.status).toBe(200);
        expect(await anonymous.json()).toEqual({ ok: true, email: null });

        const invalid = await withOptionalAuth(handler)(request("not-a-jwt"));
        expect(invalid.status).toBe(200);
        expect(await invalid.json()).toEqual({ ok: true, email: null });
    });
});
