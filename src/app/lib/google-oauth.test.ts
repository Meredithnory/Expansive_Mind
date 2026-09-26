import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { googleAuthErrorMessage } from "./google-auth-messages";
import {
    accountNamesFromGoogle,
    buildGoogleAuthorizeUrl,
    exchangeGoogleAuthorizationCode,
    GOOGLE_TOKEN_ENDPOINT,
    normalizeGoogleEmail,
    readGoogleAuthConfig,
    readGoogleOAuthState,
    readVerifiedGoogleIdentity,
    signGoogleOAuthState,
    verifyGoogleIdToken,
} from "./google-oauth";

vi.mock("server-only", () => ({}));

const SECRET = "google-oauth-test-secret";

describe("google auth helpers", () => {
    const original = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        jwt: process.env.JWT_SECRET,
    };

    beforeEach(() => {
        process.env.JWT_SECRET = SECRET;
        process.env.GOOGLE_CLIENT_ID = "client-id";
        process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    });

    afterEach(() => {
        process.env.GOOGLE_CLIENT_ID = original.clientId;
        process.env.GOOGLE_CLIENT_SECRET = original.clientSecret;
        process.env.JWT_SECRET = original.jwt;
    });

    it("reads the Google client only when both values are set", () => {
        expect(readGoogleAuthConfig("https://expansivemind.ai")).toEqual({
            clientId: "client-id",
            clientSecret: "client-secret",
            redirectUri: "https://expansivemind.ai/api/auth/google/callback",
        });

        delete process.env.GOOGLE_CLIENT_SECRET;
        expect(readGoogleAuthConfig("https://expansivemind.ai")).toBeNull();
    });

    it("builds an authorize URL that does not include the client secret", () => {
        const url = new URL(
            buildGoogleAuthorizeUrl({
                clientId: "client-id",
                redirectUri: "https://example.test/api/auth/google/callback",
                state: "state-1",
                nonce: "nonce-1",
                codeChallenge: "challenge-1",
            }),
        );

        expect(url.origin + url.pathname).toBe(
            "https://accounts.google.com/o/oauth2/v2/auth",
        );
        expect(url.searchParams.get("client_id")).toBe("client-id");
        expect(url.searchParams.get("redirect_uri")).toBe(
            "https://example.test/api/auth/google/callback",
        );
        expect(url.searchParams.get("scope")).toBe("openid email profile");
        expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        expect(url.searchParams.get("prompt")).toBe("select_account");
        expect(url.search).not.toContain("client-secret");
        expect(url.searchParams.get("client_secret")).toBeNull();
    });

    it("round-trips the oauth state and rejects other tokens", async () => {
        const signed = await signGoogleOAuthState({
            state: "state-1",
            verifier: "v".repeat(43),
            nonce: "nonce-1",
            next: "/savedpapers",
            intent: "signup",
        });
        await expect(readGoogleOAuthState(signed ?? "")).resolves.toEqual({
            state: "state-1",
            verifier: "v".repeat(43),
            nonce: "nonce-1",
            next: "/savedpapers",
            intent: "signup",
        });

        const other = await new SignJWT({ id: "user-1", purpose: "admin" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("5m")
            .sign(new TextEncoder().encode(SECRET));
        await expect(readGoogleOAuthState(other)).resolves.toBeNull();
    });

    it("matches a verified Google email the same way signup stores it", () => {
        expect(normalizeGoogleEmail("  Ada@Example.com ")).toBe(
            "ada@example.com",
        );
        expect(normalizeGoogleEmail("not-an-email")).toBeNull();

        expect(
            readVerifiedGoogleIdentity(
                {
                    sub: "google-sub",
                    email: "Ada@Example.com",
                    email_verified: true,
                    nonce: "nonce-1",
                    given_name: "Ada",
                    family_name: "Lovelace",
                },
                { nonce: "nonce-1" },
            ),
        ).toEqual({
            ok: true,
            identity: {
                sub: "google-sub",
                email: "ada@example.com",
                givenName: "Ada",
                familyName: "Lovelace",
                fullName: "",
            },
        });

        expect(
            readVerifiedGoogleIdentity(
                {
                    sub: "google-sub",
                    email: "ada@example.com",
                    email_verified: false,
                    nonce: "nonce-1",
                },
                { nonce: "nonce-1" },
            ),
        ).toEqual({ ok: false, reason: "unverified" });

        expect(
            readVerifiedGoogleIdentity(
                {
                    sub: "google-sub",
                    email: "ada@example.com",
                    email_verified: true,
                    nonce: "other",
                },
                { nonce: "nonce-1" },
            ),
        ).toEqual({ ok: false, reason: "invalid" });
    });

    it("uses Google profile names and does not invent a plan", () => {
        expect(
            accountNamesFromGoogle({
                givenName: "Ada",
                familyName: "Lovelace",
                fullName: "Ignored",
                email: "ada@example.com",
            }),
        ).toEqual({ firstName: "Ada", lastName: "Lovelace" });

        expect(
            accountNamesFromGoogle({
                givenName: "",
                familyName: "",
                fullName: "Grace Hopper",
                email: "grace@example.com",
            }),
        ).toEqual({ firstName: "Grace", lastName: "Hopper" });

        expect(
            accountNamesFromGoogle({
                givenName: "",
                familyName: "",
                fullName: "",
                email: "ada.lovelace@university.edu",
            }),
        ).toEqual({ firstName: "ada.lovelace", lastName: "." });
    });

    it("exchanges the code through a stub fetch", async () => {
        const fetchImpl = vi.fn(
            async () =>
                new Response(JSON.stringify({ id_token: "header.payload.sig" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
        );

        const result = await exchangeGoogleAuthorizationCode(
            {
                clientId: "client-id",
                clientSecret: "client-secret",
                redirectUri: "https://example.test/api/auth/google/callback",
                code: "auth-code",
                codeVerifier: "v".repeat(43),
            },
            fetchImpl,
        );

        expect(result).toEqual({ ok: true, idToken: "header.payload.sig" });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][0]).toBe(GOOGLE_TOKEN_ENDPOINT);
        const body = String(fetchImpl.mock.calls[0][1]?.body);
        expect(body).toContain("grant_type=authorization_code");
        expect(body).toContain("code_verifier=");
        expect(globalThis.fetch).not.toBe(fetchImpl);
    });

    it("asks the token checker for Google's issuer and this client id", async () => {
        const verifyImpl = vi.fn(async () => ({
            payload: { sub: "google-sub" },
        }));

        await expect(
            verifyGoogleIdToken("header.payload.sig", "client-id", verifyImpl),
        ).resolves.toEqual({ sub: "google-sub" });
        expect(verifyImpl).toHaveBeenCalledWith(
            "header.payload.sig",
            expect.any(Function),
            expect.objectContaining({
                audience: "client-id",
                issuer: ["https://accounts.google.com", "accounts.google.com"],
                algorithms: ["RS256"],
            }),
        );
    });

    it("maps only known Google error codes to screen copy", () => {
        expect(googleAuthErrorMessage("unavailable")).toMatch(/email and password/i);
        expect(googleAuthErrorMessage("not-a-real-code")).toBeNull();
    });
});
