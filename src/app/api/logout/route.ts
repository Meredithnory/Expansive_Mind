import { NextRequest, NextResponse } from "next/server";
import { hasValidMutationOrigin } from "../../lib/request-security";

export async function POST(request: NextRequest) {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const response = NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set("auth_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0,
        path: "/",
    });
    return response;
}
