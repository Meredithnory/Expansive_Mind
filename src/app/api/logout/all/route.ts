import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { consumeRateLimit } from "../../../lib/rate-limit";
import User from "../../../models/User";

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const userID = request.user._id.toString();
    const rateLimit = await consumeRateLimit({
        scope: "logout-all",
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

    await User.updateOne(
        { _id: request.user._id },
        { $inc: { tokenVersion: 1 } },
    );
    const response = NextResponse.json({
        success: true,
        message: "You're logged out everywhere.",
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
