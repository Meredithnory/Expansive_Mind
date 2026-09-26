import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { JWTVerifyGetKey, JWTVerifyOptions } from "jose";

export const GOOGLE_OAUTH_COOKIE = "google_oauth";
export const GOOGLE_OAUTH_MAX_AGE = 10 * 60;
export const GOOGLE_AUTHORIZE_ENDPOINT =
    "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const OAUTH_PURPOSE = "google-oauth";

export type GoogleOAuthIntent = "login" | "signup";

export type GoogleOAuthState = {
    state: string;
    verifier: string;
    nonce: string;
    next: string;
    intent: GoogleOAuthIntent;
};

export type GoogleIdentity = {
    sub: string;
    email: string;
    givenName: string;
    familyName: string;
    fullName: string;
};

export type GoogleAuthConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
};

type JwtVerify = (
    jwt: string,
    key: JWTVerifyGetKey,
    options?: JWTVerifyOptions,
) => Promise<{ payload: unknown }>;

let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function jwtSecretKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    return new TextEncoder().encode(secret);
}

function googleCerts() {
    if (!googleJwks) {
        googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    }
    return googleJwks;
}

export function googleRedirectUri(appOrigin: string) {
    return `${appOrigin}/api/auth/google/callback`;
}

export function readGoogleAuthConfig(appOrigin: string): GoogleAuthConfig | null {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
    if (!clientId || !clientSecret || !appOrigin) return null;
    return {
        clientId,
        clientSecret,
        redirectUri: googleRedirectUri(appOrigin),
    };
}

export function createPkcePair() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
}

export function buildGoogleAuthorizeUrl(input: {
    clientId: string;
    redirectUri: string;
    state: string;
    nonce: string;
    codeChallenge: string;
}) {
    const url = new URL(GOOGLE_AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", input.state);
    url.searchParams.set("nonce", input.nonce);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
}

export async function signGoogleOAuthState(state: GoogleOAuthState) {
    const key = jwtSecretKey();
    if (!key) return null;
    return new SignJWT({
        purpose: OAUTH_PURPOSE,
        state: state.state,
        verifier: state.verifier,
        nonce: state.nonce,
        next: state.next,
        intent: state.intent,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${GOOGLE_OAUTH_MAX_AGE}s`)
        .sign(key);
}

export async function readGoogleOAuthState(
    token?: string,
): Promise<GoogleOAuthState | null> {
    const key = jwtSecretKey();
    if (!key || !token) return null;
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ["HS256"],
        });
        if (payload.purpose !== OAUTH_PURPOSE) return null;
        if (typeof payload.state !== "string" || !payload.state) return null;
        if (typeof payload.verifier !== "string" || payload.verifier.length < 43) {
            return null;
        }
        if (typeof payload.nonce !== "string" || !payload.nonce) return null;
        if (payload.intent !== "login" && payload.intent !== "signup") {
            return null;
        }
        if (typeof payload.next !== "string" || !payload.next.startsWith("/")) {
            return null;
        }
        return {
            state: payload.state,
            verifier: payload.verifier,
            nonce: payload.nonce,
            next: payload.next,
            intent: payload.intent,
        };
    } catch {
        return null;
    }
}

export function oauthStateMatches(expected: string, provided: string | null) {
    if (!provided) return false;
    const left = Buffer.from(expected);
    const right = Buffer.from(provided);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

export function googleOAuthCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: GOOGLE_OAUTH_MAX_AGE,
        path: "/api/auth/google",
    };
}

export function clearGoogleOAuthCookieOptions() {
    return {
        ...googleOAuthCookieOptions(),
        maxAge: 0,
    };
}

export function normalizeGoogleEmail(email: unknown) {
    if (typeof email !== "string") return null;
    const normalized = email.trim().toLowerCase();
    if (normalized.length < 3 || normalized.length > 254) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
    return normalized;
}

function clipped(value: unknown, max: number) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed.slice(0, max);
}

export function readVerifiedGoogleIdentity(
    payload: unknown,
    expected: { nonce: string },
):
    | { ok: true; identity: GoogleIdentity }
    | { ok: false; reason: "invalid" | "unverified" } {
    if (!payload || typeof payload !== "object") {
        return { ok: false, reason: "invalid" };
    }
    const record = payload as Record<string, unknown>;
    if (record.nonce !== expected.nonce) {
        return { ok: false, reason: "invalid" };
    }
    const email = normalizeGoogleEmail(record.email);
    const verified = record.email_verified === true || record.email_verified === "true";
    if (!verified) {
        return { ok: false, reason: email ? "unverified" : "invalid" };
    }
    const sub = clipped(record.sub, 255);
    if (!email || !sub) return { ok: false, reason: "invalid" };
    return {
        ok: true,
        identity: {
            sub,
            email,
            givenName: clipped(record.given_name, 100),
            familyName: clipped(record.family_name, 100),
            fullName: clipped(record.name, 200),
        },
    };
}

export function accountNamesFromGoogle(identity: {
    givenName: string;
    familyName: string;
    fullName: string;
    email: string;
}) {
    const given = clipped(identity.givenName, 100);
    const family = clipped(identity.familyName, 100);
    if (given && family) return { firstName: given, lastName: family };
    if (given) return { firstName: given, lastName: "." };

    const parts = clipped(identity.fullName, 200).split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return {
            firstName: parts[0].slice(0, 100),
            lastName: parts.slice(1).join(" ").slice(0, 100),
        };
    }
    if (parts.length === 1) return { firstName: parts[0], lastName: "." };

    const local = identity.email.split("@")[0] ?? "";
    const cleaned = local.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 100);
    return { firstName: cleaned || "Reader", lastName: "." };
}

export function randomGooglePassword() {
    return randomBytes(48).toString("base64url");
}

export function googleFlowPageUrl(
    origin: string,
    intent: GoogleOAuthIntent,
    params: { google?: string; next?: string },
) {
    const url = new URL(intent === "signup" ? "/signup" : "/login", origin);
    if (params.google) url.searchParams.set("google", params.google);
    if (params.next && params.next !== "/discover") {
        url.searchParams.set("next", params.next);
    }
    return url;
}

export async function exchangeGoogleAuthorizationCode(
    input: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        code: string;
        codeVerifier: string;
    },
    fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; idToken: string } | { ok: false }> {
    if (!input.code || input.code.length > 2048) return { ok: false };
    let response: Response;
    try {
        response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: new URLSearchParams({
                code: input.code,
                client_id: input.clientId,
                client_secret: input.clientSecret,
                redirect_uri: input.redirectUri,
                grant_type: "authorization_code",
                code_verifier: input.codeVerifier,
            }),
        });
    } catch {
        return { ok: false };
    }
    if (!response.ok) return { ok: false };
    try {
        const body = (await response.json()) as { id_token?: unknown };
        if (typeof body.id_token !== "string" || !body.id_token) {
            return { ok: false };
        }
        return { ok: true, idToken: body.id_token };
    } catch {
        return { ok: false };
    }
}

export async function verifyGoogleIdToken(
    idToken: string,
    clientId: string,
    verifyImpl: JwtVerify = jwtVerify as JwtVerify,
) {
    try {
        const { payload } = await verifyImpl(idToken, googleCerts(), {
            algorithms: ["RS256"],
            issuer: ["https://accounts.google.com", "accounts.google.com"],
            audience: clientId,
        });
        return payload;
    } catch {
        return null;
    }
}
