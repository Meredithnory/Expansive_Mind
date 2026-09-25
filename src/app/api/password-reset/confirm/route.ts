import { NextRequest, NextResponse } from "next/server";
import User from "../../../models/User";
import connectDB from "../../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../../lib/request-security";
import { sessionVersion } from "../../../lib/session-version";
import {
    PASSWORD_RESET_CONFIRM_RATE_LIMIT,
    PASSWORD_RESET_LINK_INVALID,
    PASSWORD_RESET_PASSWORD_RULE,
    PASSWORD_RESET_UPDATED,
    hashPasswordResetToken,
    isPasswordResetToken,
    normalizeNewPassword,
} from "../../../lib/password-reset";

function clearAuthCookie(response: NextResponse) {
    response.cookies.set("auth_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0,
        path: "/",
    });
    return response;
}

export async function POST(request: NextRequest) {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { success: false, message: "Invalid origin." },
                { status: 403 },
            );
        }

        const parsedBody = await readLimitedJsonBody(request, 8 * 1024);
        if (!parsedBody.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please check the reset link and password.",
                },
                { status: parsedBody.status },
            );
        }

        const rateLimit = await consumeRateLimit({
            scope: "password-reset-confirm",
            identity: requestIp(request),
            limit: 10,
            windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_CONFIRM_RATE_LIMIT },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const body = parsedBody.value as Record<string, unknown>;
        const password = normalizeNewPassword(body.password);
        if (!password) {
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_PASSWORD_RULE },
                { status: 400 },
            );
        }

        const token = typeof body.token === "string" ? body.token : "";
        if (!isPasswordResetToken(token)) {
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_LINK_INVALID },
                { status: 400 },
            );
        }

        await connectDB();
        const claimed = await User.findOneAndUpdate(
            {
                passwordResetTokenHash: hashPasswordResetToken(token),
                passwordResetExpiresAt: { $gt: new Date() },
            },
            {
                $unset: {
                    passwordResetTokenHash: 1,
                    passwordResetExpiresAt: 1,
                },
            },
            { new: true },
        );
        if (!claimed) {
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_LINK_INVALID },
                { status: 400 },
            );
        }

        claimed.password = password;
        claimed.tokenVersion = sessionVersion(claimed.tokenVersion) + 1;
        await claimed.save();

        return clearAuthCookie(
            NextResponse.json({
                success: true,
                message: PASSWORD_RESET_UPDATED,
            }),
        );
    } catch {
        console.error("Password reset confirm failed");
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 },
        );
    }
}
