import { NextRequest, NextResponse } from "next/server";
import { hasValidMutationOrigin } from "../../lib/request-security";
import {
    ADMIN_MFA_COOKIE,
    ADMIN_SESSION_COOKIE,
    AUTH_COOKIE,
    adminMfaCookieOptions,
    adminSessionCookieOptions,
    authCookieOptions,
} from "../../lib/admin-session";

export async function POST(request: NextRequest) {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const response = NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(AUTH_COOKIE, "", authCookieOptions(0));
    response.cookies.set(
        ADMIN_SESSION_COOKIE,
        "",
        adminSessionCookieOptions(0),
    );
    response.cookies.set(ADMIN_MFA_COOKIE, "", adminMfaCookieOptions(0));
    return response;
}
