import "server-only";
import { randomBytes } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { hashQuotaIdentity } from "./quota-identity";

// The anonymous visit counter cookie shared by /api/audience, /api/activity,
// and /api/ratings. Only its scrambled key is stored.
const COOKIE = "em_audience";

export type AudienceVisitor = { token: string; fresh: boolean };

export function audienceVisitor(request: NextRequest): AudienceVisitor {
    const existing = request.cookies.get(COOKIE)?.value;
    if (existing && /^[a-f0-9]{32}$/.test(existing)) {
        return { token: existing, fresh: false };
    }
    return { token: randomBytes(16).toString("hex"), fresh: true };
}

export function audienceVisitorKey(token: string) {
    return hashQuotaIdentity(`audience:${token}`);
}

export function withAudienceCookie(response: NextResponse, visitor: AudienceVisitor) {
    if (!visitor.fresh) return response;
    response.cookies.set(COOKIE, visitor.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 120,
    });
    return response;
}
