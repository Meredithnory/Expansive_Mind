import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";
import {
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken,
} from "./app/lib/admin-session";

const originalSecret = process.env.JWT_SECRET;

async function token(email?: string) {
    return new SignJWT({
        id: "user-1",
        tokenVersion: 0,
        ...(email ? { email } : {}),
    })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

function request(
    pathname: string,
    options?: { authToken?: string; adminSession?: string },
) {
    const parts: string[] = [];
    if (options?.authToken) {
        parts.push(`auth_token=${options.authToken}`);
    }
    if (options?.adminSession) {
        parts.push(`${ADMIN_SESSION_COOKIE}=${options.adminSession}`);
    }
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

    it("allows anonymous access to /admin/login", async () => {
        const response = await middleware(request("/admin/login"));

        expect(response.headers.get("x-middleware-next")).toBe("1");
        expect(response.headers.get("location")).toBeNull();
    });

    it("allows anonymous access to nested /admin/login paths", async () => {
        const response = await middleware(request("/admin/login/"));

        expect(response.headers.get("x-middleware-next")).toBe("1");
        expect(response.headers.get("location")).toBeNull();
    });

    it("redirects signed-in users without an admin session away from /admin", async () => {
        const response = await middleware(
            request("/admin", { authToken: await token("member@example.test") }),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/admin/login",
        );
        expect(response.headers.get("location")).not.toBe(
            "https://example.test/login",
        );
    });

    it("allows /admin when a valid admin_session cookie is present", async () => {
        const adminSession = await createAdminSessionToken("user-1");
        const response = await middleware(
            request("/admin/usage", {
                authToken: await token(),
                adminSession,
            }),
        );

        expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("redirects anonymous /admin requests to /admin/login", async () => {
        const response = await middleware(request("/admin"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/admin/login",
        );
    });
});
