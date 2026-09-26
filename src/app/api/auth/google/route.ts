import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "../../../lib/rate-limit";
import {
    buildGoogleAuthorizeUrl,
    createPkcePair,
    googleFlowPageUrl,
    googleOAuthCookieOptions,
    GOOGLE_OAUTH_COOKIE,
    readGoogleAuthConfig,
    signGoogleOAuthState,
    type GoogleOAuthIntent,
} from "../../../lib/google-oauth";
import { safeInternalPath } from "../../../lib/safe-internal-path";
import { trustedApplicationOrigin } from "../../../lib/request-security";

function intentFrom(value: string | null): GoogleOAuthIntent {
    return value === "signup" ? "signup" : "login";
}

function nextPathFrom(value: string | null) {
    if (!value || value.length > 512) return safeInternalPath(null);
    return safeInternalPath(value);
}

function redirectToAuthPage(
    origin: string,
    intent: GoogleOAuthIntent,
    code: string,
    next: string,
) {
    const response = NextResponse.redirect(
        googleFlowPageUrl(origin, intent, { google: code, next }),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}

export async function GET(request: NextRequest) {
    let origin: string;
    try {
        origin = trustedApplicationOrigin(request);
    } catch {
        return NextResponse.json(
            { success: false, message: "App URL is not configured." },
            { status: 500 },
        );
    }

    const intent = intentFrom(request.nextUrl.searchParams.get("intent"));
    const next = nextPathFrom(request.nextUrl.searchParams.get("next"));
    const purpose =
        request.headers.get("sec-purpose") || request.headers.get("purpose");
    if (purpose?.includes("prefetch")) {
        return new NextResponse(null, {
            status: 204,
            headers: { "Cache-Control": "private, no-store" },
        });
    }

    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
        return redirectToAuthPage(origin, intent, "failed", next);
    }

    const rateLimit = await consumeRateLimit({
        scope: "google-auth",
        identity: requestIp(request),
        limit: 12,
        windowMs: 15 * 60_000,
    });
    if (!rateLimit.allowed) {
        return redirectToAuthPage(origin, intent, "limited", next);
    }

    const config = readGoogleAuthConfig(origin);
    if (!config || !process.env.JWT_SECRET) {
        return redirectToAuthPage(origin, intent, "unavailable", next);
    }

    const { verifier, challenge } = createPkcePair();
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const signed = await signGoogleOAuthState({
        state,
        verifier,
        nonce,
        next,
        intent,
    });
    if (!signed) {
        return redirectToAuthPage(origin, intent, "unavailable", next);
    }

    const response = NextResponse.redirect(
        buildGoogleAuthorizeUrl({
            clientId: config.clientId,
            redirectUri: config.redirectUri,
            state,
            nonce,
            codeChallenge: challenge,
        }),
    );
    response.cookies.set(
        GOOGLE_OAUTH_COOKIE,
        signed,
        googleOAuthCookieOptions(),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
