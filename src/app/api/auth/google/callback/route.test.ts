import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    save: vi.fn(async (user: unknown) => user),
    connectDB: vi.fn(),
    consumeRateLimit: vi.fn(),
    requestIp: vi.fn(() => "203.0.113.10"),
    exchange: vi.fn(),
    verify: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../db/connectDB", () => ({
    default: mocks.connectDB,
}));
vi.mock("../../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: mocks.requestIp,
}));
vi.mock("../../../../lib/google-oauth", async () => {
    const actual = await vi.importActual<
        typeof import("../../../../lib/google-oauth")
    >("../../../../lib/google-oauth");
    return {
        ...actual,
        exchangeGoogleAuthorizationCode: mocks.exchange,
        verifyGoogleIdToken: mocks.verify,
    };
});
vi.mock("../../../../models/User", () => {
    class User {
        _id = { toString: () => "507f1f77bcf86cd799439011" };
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

import { GET } from "./route";
import { signGoogleOAuthState } from "../../../../lib/google-oauth";

const SECRET = "google-callback-test-secret";
const STATE = "state-value";
const NONCE = "nonce-value";
const VERIFIER = "v".repeat(43);

function callbackRequest(query: string, cookie?: string) {
    return new NextRequest(
        `https://example.test/api/auth/google/callback?${query}`,
        {
            headers: cookie ? { cookie } : undefined,
        },
    );
}

async function stateCookie(
    intent: "login" | "signup" = "login",
    next = "/savedpapers",
) {
    const signed = await signGoogleOAuthState({
        state: STATE,
        verifier: VERIFIER,
        nonce: NONCE,
        next,
        intent,
    });
    return `google_oauth=${signed}`;
}

function cookieHeader(response: Response) {
    const headers = response.headers as Headers & {
        getSetCookie?: () => string[];
    };
    return (headers.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""]).join(
        "\n",
    );
}

describe("GET /api/auth/google/callback", () => {
    const original = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        jwt: process.env.JWT_SECRET,
        appUrl: process.env.APP_URL,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
            new Error("Google must not be called"),
        );
        process.env.JWT_SECRET = SECRET;
        process.env.GOOGLE_CLIENT_ID = "client-id";
        process.env.GOOGLE_CLIENT_SECRET = "client-secret";
        process.env.APP_URL = "https://example.test";
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 11,
            retryAfterSeconds: 60,
        });
        mocks.exchange.mockResolvedValue({
            ok: true,
            idToken: "header.payload.sig",
        });
        mocks.verify.mockResolvedValue({
            sub: "google-sub-1",
            email: "Ada@Example.com",
            email_verified: true,
            nonce: NONCE,
            given_name: "Ada",
            family_name: "Lovelace",
        });
        mocks.findOne.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.GOOGLE_CLIENT_ID = original.clientId;
        process.env.GOOGLE_CLIENT_SECRET = original.clientSecret;
        process.env.JWT_SECRET = original.jwt;
        process.env.APP_URL = original.appUrl;
    });

    it("signs into the existing account for that email without changing it", async () => {
        const existing = {
            _id: { toString: () => "existing-user-id" },
            email: "ada@example.com",
            password: "already-hashed",
            tokenVersion: 4,
            plan: "pro",
            adminTotpEnabled: true,
            adminTotpSecret: "encrypted-secret",
        };
        mocks.findOne.mockResolvedValue(existing);

        const response = await GET(
            callbackRequest(`code=auth-code&state=${STATE}`, await stateCookie()),
        );
        const setCookie = cookieHeader(response);
        const token = setCookie.match(/auth_token=([^;]+)/)?.[1];
        const payload = jwt.verify(decodeURIComponent(token ?? ""), SECRET);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "https://example.test/savedpapers",
        );
        expect(mocks.findOne).toHaveBeenCalledWith({ email: "ada@example.com" });
        expect(mocks.save).not.toHaveBeenCalled();
        expect(existing.password).toBe("already-hashed");
        expect(existing.plan).toBe("pro");
        expect(existing.adminTotpSecret).toBe("encrypted-secret");
        expect(payload).toEqual(
            expect.objectContaining({
                id: "existing-user-id",
                email: "ada@example.com",
                tokenVersion: 4,
            }),
        );
        expect(setCookie).toContain("auth_token=");
        expect(setCookie).toContain("SameSite=strict");
        expect(setCookie).not.toContain("admin_session=");
        expect(setCookie).not.toContain("admin_mfa=");
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("creates a normal user when the email is new", async () => {
        const response = await GET(
            callbackRequest(
                `code=auth-code&state=${STATE}`,
                await stateCookie("signup", "/discover"),
            ),
        );
        const saved = mocks.save.mock.calls[0][0] as {
            firstName: string;
            lastName: string;
            email: string;
            password: string;
            plan?: string;
            accessOverride?: string;
            stripeCustomerId?: string;
        };

        expect(response.headers.get("location")).toBe(
            "https://example.test/discover",
        );
        expect(mocks.findOne).toHaveBeenCalledWith({ email: "ada@example.com" });
        expect(saved.firstName).toBe("Ada");
        expect(saved.lastName).toBe("Lovelace");
        expect(saved.email).toBe("ada@example.com");
        expect(saved.password.length).toBeGreaterThanOrEqual(43);
        expect(saved.plan).toBeUndefined();
        expect(saved.accessOverride).toBeUndefined();
        expect(saved.stripeCustomerId).toBeUndefined();
        expect(cookieHeader(response)).not.toContain("admin_session=");
    });

    it("signs into the existing row if create races a duplicate email", async () => {
        const existing = {
            _id: { toString: () => "existing-user-id" },
            email: "ada@example.com",
            tokenVersion: 1,
            password: "already-hashed",
            plan: "free",
        };
        mocks.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existing);
        mocks.save.mockRejectedValueOnce(
            Object.assign(new Error("duplicate"), { code: 11000 }),
        );

        const response = await GET(
            callbackRequest(`code=auth-code&state=${STATE}`, await stateCookie()),
        );
        const token = cookieHeader(response).match(/auth_token=([^;]+)/)?.[1];
        const payload = jwt.verify(decodeURIComponent(token ?? ""), SECRET);

        expect(payload).toEqual(
            expect.objectContaining({ id: "existing-user-id" }),
        );
        expect(existing.password).toBe("already-hashed");
        expect(existing.plan).toBe("free");
    });

    it("refuses an unverified Google email", async () => {
        mocks.verify.mockResolvedValue({
            sub: "google-sub-1",
            email: "ada@example.com",
            email_verified: false,
            nonce: NONCE,
        });

        const response = await GET(
            callbackRequest(
                `code=auth-code&state=${STATE}`,
                await stateCookie("signup"),
            ),
        );

        expect(response.headers.get("location")).toBe(
            "https://example.test/signup?google=unverified&next=%2Fsavedpapers",
        );
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.save).not.toHaveBeenCalled();
    });

    it("does not exchange a code when the state cookie does not match", async () => {
        const response = await GET(
            callbackRequest("code=auth-code&state=attacker", await stateCookie()),
        );

        expect(response.headers.get("location")).toBe(
            "https://example.test/login?google=failed&next=%2Fsavedpapers",
        );
        expect(mocks.exchange).not.toHaveBeenCalled();
        expect(mocks.findOne).not.toHaveBeenCalled();
    });
});
