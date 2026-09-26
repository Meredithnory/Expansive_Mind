import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.10"),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));

import { GET } from "./route";
import { GOOGLE_OAUTH_COOKIE } from "../../../lib/google-oauth";

const SECRET = "google-start-test-secret";

function startRequest(
    path: string,
    headers: Record<string, string> = { "sec-fetch-site": "same-origin" },
) {
    return new NextRequest(`https://example.test${path}`, { headers });
}

describe("GET /api/auth/google", () => {
    const original = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        jwt: process.env.JWT_SECRET,
        appUrl: process.env.APP_URL,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = SECRET;
        process.env.GOOGLE_CLIENT_ID = "client-id";
        process.env.GOOGLE_CLIENT_SECRET = "client-secret";
        process.env.APP_URL = "https://example.test";
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 11,
            retryAfterSeconds: 60,
        });
    });

    afterEach(() => {
        process.env.GOOGLE_CLIENT_ID = original.clientId;
        process.env.GOOGLE_CLIENT_SECRET = original.clientSecret;
        process.env.JWT_SECRET = original.jwt;
        process.env.APP_URL = original.appUrl;
    });

    it("sends the browser to Google and stores a signed state cookie", async () => {
        const response = await GET(
            startRequest("/api/auth/google?intent=signup&next=/savedpapers"),
        );
        const location = response.headers.get("location") ?? "";
        const url = new URL(location);
        const setCookie = response.headers.get("set-cookie") ?? "";
        const cookie = setCookie.match(
            new RegExp(`${GOOGLE_OAUTH_COOKIE}=([^;]+)`),
        )?.[1];
        const { payload } = await jwtVerify(
            decodeURIComponent(cookie ?? ""),
            new TextEncoder().encode(SECRET),
        );

        expect(response.status).toBe(307);
        expect(url.origin + url.pathname).toBe(
            "https://accounts.google.com/o/oauth2/v2/auth",
        );
        expect(url.searchParams.get("redirect_uri")).toBe(
            "https://example.test/api/auth/google/callback",
        );
        expect(url.searchParams.get("client_secret")).toBeNull();
        expect(url.search).not.toContain("client-secret");
        expect(payload.intent).toBe("signup");
        expect(payload.next).toBe("/savedpapers");
        expect(payload.state).toBe(url.searchParams.get("state"));
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("SameSite=lax");
        expect(setCookie).toContain("Path=/api/auth/google");
        expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
            expect.objectContaining({ scope: "google-auth" }),
        );
    });

    it("stays on the auth screen when Google is not configured", async () => {
        delete process.env.GOOGLE_CLIENT_ID;

        const response = await GET(startRequest("/api/auth/google?intent=login"));

        expect(response.headers.get("location")).toBe(
            "https://example.test/login?google=unavailable",
        );
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("drops an external next path before leaving the site", async () => {
        const response = await GET(
            startRequest("/api/auth/google?next=https://evil.example/phish"),
        );
        const setCookie = response.headers.get("set-cookie") ?? "";
        const cookie = setCookie.match(
            new RegExp(`${GOOGLE_OAUTH_COOKIE}=([^;]+)`),
        )?.[1];
        const { payload } = await jwtVerify(
            decodeURIComponent(cookie ?? ""),
            new TextEncoder().encode(SECRET),
        );

        expect(response.headers.get("location")).not.toContain("evil.example");
        expect(payload.next).toBe("/discover");
    });

    it("rejects a cross-site start before talking to Google", async () => {
        const response = await GET(
            startRequest("/api/auth/google", { "sec-fetch-site": "cross-site" }),
        );

        expect(response.headers.get("location")).toBe(
            "https://example.test/login?google=failed",
        );
        expect(response.headers.get("location")).not.toContain(
            "accounts.google.com",
        );
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    });
});
