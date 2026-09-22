import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";
import { ADMIN_SESSION_COOKIE } from "./app/lib/admin-session";

const originalSecret = process.env.JWT_SECRET;

async function token(payload: Record<string, string> = { id: "user-1" }) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

function request(
    pathname: string,
    cookies?: { authToken?: string; adminToken?: string },
) {
    const parts = [
        cookies?.authToken ? `auth_token=${cookies.authToken}` : "",
        cookies?.adminToken
            ? `${ADMIN_SESSION_COOKIE}=${cookies.adminToken}`
            : "",
    ].filter(Boolean);
    return new NextRequest(`https://example.test${pathname}`, {
        headers: parts.length ? { cookie: parts.join("; ") } : undefined,
    });
}

describe("auth navigation middleware", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = "middleware-test-secret";
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.JWT_SECRET = originalSecret;
    });

    it("only matches protected route trees and exact auth routes", () => {
        expect(config.matcher).toEqual([
            "/savedpapers/:path*",
            "/projects/:path*",
            "/admin",
            "/admin/:path*",
            "/login",
            "/signup",
        ]);
    });

    it("redirects anonymous protected requests to login", async () => {
        const response = await middleware(request("/projects/abc"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/login",
        );
    });

    it("allows anonymous admin login requests", async () => {
        const response = await middleware(request("/admin/login"));

        expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("redirects anonymous admin portal requests to admin login", async () => {
        const response = await middleware(request("/admin"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/admin/login",
        );
    });

    it("does not treat a product session as admin access", async () => {
        const response = await middleware(
            request("/admin", { authToken: await token() }),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/admin/login",
        );
    });

    it("allows admin portal requests with matching auth and admin sessions", async () => {
        const authToken = await token({ id: "owner-1" });
        const adminToken = await token({ id: "owner-1", role: "admin" });
        const response = await middleware(
            request("/admin", { authToken, adminToken }),
        );

        expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("rejects an admin session that belongs to a different user", async () => {
        const response = await middleware(
            request("/admin", {
                authToken: await token({ id: "owner-1" }),
                adminToken: await token({ id: "other", role: "admin" }),
            }),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/admin/login",
        );
    });

    it("allows anonymous auth requests", async () => {
        const response = await middleware(request("/login"));

        expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("redirects authenticated auth requests to discover", async () => {
        const response = await middleware(
            request("/signup", { authToken: await token() }),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/discover",
        );
    });

    it("clears invalid tokens while redirecting", async () => {
        const response = await middleware(
            request("/savedpapers", { authToken: "not-a-valid-token" }),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("set-cookie")).toContain(
            "auth_token=; Path=/; Expires=",
        );
    });
});
