import { NextRequest, NextResponse } from "next/server";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import {
    ADMIN_SESSION_COOKIE,
    adminSessionCookieOptions,
} from "../../../lib/admin-session";

export async function POST(request: NextRequest) {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const response = NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(
        ADMIN_SESSION_COOKIE,
        "",
        adminSessionCookieOptions(0),
    );
    return response;
}
