import { NextRequest, NextResponse } from "next/server";
import User from "../../models/User";
import connectDB from "../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
    trustedApplicationOrigin,
} from "../../lib/request-security";
import { sendPasswordResetEmail } from "../../lib/password-reset-mail";
import {
    PASSWORD_RESET_INVALID_EMAIL,
    PASSWORD_RESET_RATE_LIMIT,
    PASSWORD_RESET_REQUEST_MESSAGE,
    PASSWORD_RESET_TTL_MS,
    PASSWORD_RESET_UNAVAILABLE,
    buildPasswordResetLink,
    createPasswordResetToken,
    hashPasswordResetToken,
    normalizeAccountEmail,
} from "../../lib/password-reset";

function tooMany(retryAfterSeconds: number) {
    return NextResponse.json(
        { success: false, message: PASSWORD_RESET_RATE_LIMIT },
        {
            status: 429,
            headers: { "Retry-After": String(retryAfterSeconds) },
        },
    );
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
                    message:
                        parsedBody.status === 413
                            ? "That request is too large."
                            : "A valid reset request is required.",
                },
                { status: parsedBody.status },
            );
        }

        const ipLimit = await consumeRateLimit({
            scope: "password-reset",
            identity: requestIp(request),
            limit: 5,
            windowMs: 15 * 60_000,
        });
        if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSeconds);

        const body = parsedBody.value as Record<string, unknown>;
        const email = normalizeAccountEmail(body.email);
        if (!email) {
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_INVALID_EMAIL },
                { status: 400 },
            );
        }

        const emailLimit = await consumeRateLimit({
            scope: "password-reset-email",
            identity: email,
            limit: 3,
            windowMs: 60 * 60_000,
        });
        if (!emailLimit.allowed) return tooMany(emailLimit.retryAfterSeconds);

        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_UNAVAILABLE },
                { status: 503 },
            );
        }

        let origin: string;
        try {
            origin = trustedApplicationOrigin(request);
        } catch {
            console.error("Password reset origin is not configured");
            return NextResponse.json(
                { success: false, message: PASSWORD_RESET_UNAVAILABLE },
                { status: 503 },
            );
        }

        await connectDB();
        const user = await User.findOne({ email });
        if (user) {
            try {
                const token = createPasswordResetToken();
                user.passwordResetTokenHash = hashPasswordResetToken(token);
                user.passwordResetExpiresAt = new Date(
                    Date.now() + PASSWORD_RESET_TTL_MS,
                );
                await user.save();
                const sent = await sendPasswordResetEmail({
                    to: email,
                    link: buildPasswordResetLink(origin, token),
                });
                if (!sent.accepted) {
                    user.passwordResetTokenHash = null;
                    user.passwordResetExpiresAt = null;
                    await user.save();
                    console.error(
                        "Password reset email was not accepted",
                        sent.status,
                    );
                }
            } catch {
                console.error("Password reset request failed");
            }
        }

        return NextResponse.json({
            success: true,
            message: PASSWORD_RESET_REQUEST_MESSAGE,
        });
    } catch {
        console.error("Password reset request failed");
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 },
        );
    }
}
