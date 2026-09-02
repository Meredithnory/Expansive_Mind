import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";

const originalSecret = process.env.JWT_SECRET;

async function token() {
    return new SignJWT({ id: "user-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

function request(pathname: string, authToken?: string) {
    return new NextRequest(`https://example.test${pathname}`, {
        headers: authToken
            ? { cookie: `auth_token=${authToken}` }
            : undefined,
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
        const response = await middleware(request("/signup", await token()));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/discover",
        );
    });

    it("clears invalid tokens while redirecting", async () => {
        const response = await middleware(
            request("/savedpapers", "not-a-valid-token"),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("set-cookie")).toContain(
            "auth_token=; Path=/; Expires=",
        );
    });
});
