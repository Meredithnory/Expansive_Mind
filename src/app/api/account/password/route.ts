import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../../lib/request-security";
import { consumeRateLimit } from "../../../lib/rate-limit";
import { sessionVersion } from "../../../lib/session-version";

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const userID = request.user._id.toString();
    const rateLimit = await consumeRateLimit({
        scope: "password-change",
        identity: userID,
        limit: 5,
        windowMs: 60 * 60 * 1_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many tries. Give it a little time and try again." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rateLimit.retryAfterSeconds),
                },
            },
        );
    }

    const parsed = await readLimitedJsonBody(request, 8 * 1024);
    if (!parsed.ok) {
        return NextResponse.json(
            { error: "Please check both password fields." },
            { status: parsed.status },
        );
    }
    const body = parsed.value as Record<string, unknown>;
    const currentPassword =
        typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
        typeof body.newPassword === "string" ? body.newPassword.trim() : "";
    if (
        !currentPassword ||
        newPassword.length < 6 ||
        currentPassword.length > 128 ||
        newPassword.length > 128
    ) {
        return NextResponse.json(
            { error: "Use a new password between 6 and 128 characters." },
            { status: 400 },
        );
    }
    if (!(await bcrypt.compare(currentPassword, request.user.password))) {
        return NextResponse.json(
            { error: "That current password doesn't match." },
            { status: 400 },
        );
    }

    request.user.password = newPassword;
    request.user.tokenVersion =
        sessionVersion(request.user.tokenVersion) + 1;
    await request.user.save();

    const response = NextResponse.json({
        success: true,
        message: "Password updated. You're logged out everywhere.",
    });
    response.cookies.set("auth_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0,
        path: "/",
    });
    return response;
});
