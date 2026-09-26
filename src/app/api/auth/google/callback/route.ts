import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import User from "../../../../models/User";
import connectDB from "../../../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../../../lib/rate-limit";
import { sessionVersion } from "../../../../lib/session-version";
import { safeInternalPath } from "../../../../lib/safe-internal-path";
import { trustedApplicationOrigin } from "../../../../lib/request-security";
import {
    accountNamesFromGoogle,
    clearGoogleOAuthCookieOptions,
    exchangeGoogleAuthorizationCode,
    googleFlowPageUrl,
    GOOGLE_OAUTH_COOKIE,
    oauthStateMatches,
    randomGooglePassword,
    readGoogleAuthConfig,
    readGoogleOAuthState,
    readVerifiedGoogleIdentity,
    verifyGoogleIdToken,
    type GoogleOAuthIntent,
} from "../../../../lib/google-oauth";

const maxAge = 24 * 60 * 60;

function isDuplicateKey(error: unknown) {
    return Boolean(
        error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code?: unknown }).code === 11000,
    );
}

function pageRedirect(
    origin: string,
    intent: GoogleOAuthIntent,
    code: string,
    next: string,
) {
    const response = NextResponse.redirect(
        googleFlowPageUrl(origin, intent, { google: code, next }),
    );
    response.cookies.set(GOOGLE_OAUTH_COOKIE, "", clearGoogleOAuthCookieOptions());
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

    const stored = await readGoogleOAuthState(
        request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value,
    );
    const intent = stored?.intent ?? "login";
    const next = stored?.next ?? "/discover";

    const rateLimit = await consumeRateLimit({
        scope: "google-auth",
        identity: requestIp(request),
        limit: 12,
        windowMs: 15 * 60_000,
    });
    if (!rateLimit.allowed) {
        return pageRedirect(origin, intent, "limited", next);
    }

    const googleError = request.nextUrl.searchParams.get("error");
    if (googleError) {
        return pageRedirect(
            origin,
            intent,
            googleError === "access_denied" ? "denied" : "failed",
            next,
        );
    }

    if (
        !stored ||
        !oauthStateMatches(stored.state, request.nextUrl.searchParams.get("state"))
    ) {
        return pageRedirect(origin, intent, "failed", next);
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 2048) {
        return pageRedirect(origin, intent, "failed", next);
    }

    const config = readGoogleAuthConfig(origin);
    if (!config || !process.env.JWT_SECRET) {
        return pageRedirect(origin, intent, "unavailable", next);
    }

    const exchanged = await exchangeGoogleAuthorizationCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        code,
        codeVerifier: stored.verifier,
    });
    if (!exchanged.ok) {
        return pageRedirect(origin, intent, "failed", next);
    }

    const payload = await verifyGoogleIdToken(exchanged.idToken, config.clientId);
    const identity = readVerifiedGoogleIdentity(payload, { nonce: stored.nonce });
    if (!identity.ok) {
        return pageRedirect(
            origin,
            intent,
            identity.reason === "unverified" ? "unverified" : "failed",
            next,
        );
    }

    try {
        await connectDB();
        const email = identity.identity.email;
        // Same account as email signup/login: normalized email, unchanged plan.
        let user = await User.findOne({ email });
        if (!user) {
            const names = accountNamesFromGoogle(identity.identity);
            const created = new User({
                firstName: names.firstName,
                lastName: names.lastName,
                email,
                password: randomGooglePassword(),
            });
            try {
                user = await created.save();
            } catch (error) {
                if (!isDuplicateKey(error)) throw error;
                user = await User.findOne({ email });
                if (!user) throw error;
            }
        }

        if (!user._id || typeof user.email !== "string") {
            return pageRedirect(origin, intent, "failed", next);
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email.trim().toLowerCase(),
                tokenVersion: sessionVersion(user.tokenVersion),
            },
            process.env.JWT_SECRET,
            { algorithm: "HS256", expiresIn: maxAge },
        );
        const response = NextResponse.redirect(
            new URL(safeInternalPath(next), origin),
        );
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge,
            path: "/",
        });
        response.cookies.set(
            GOOGLE_OAUTH_COOKIE,
            "",
            clearGoogleOAuthCookieOptions(),
        );
        response.headers.set("Cache-Control", "private, no-store");
        return response;
    } catch {
        console.error("Google sign-in failed");
        return pageRedirect(origin, intent, "failed", next);
    }
}
