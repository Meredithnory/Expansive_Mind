import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import User from "../../../models/User";
import connectDB from "../../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../../lib/rate-limit";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { isAdminIdentity } from "../../../lib/admin-identity";
import {
    createTotpSecret,
    encryptTotpSecret,
    totpQrDataUrl,
} from "../../../lib/admin-totp";
import {
    ADMIN_MFA_COOKIE,
    adminMfaCookieOptions,
    createAdminMfaToken,
} from "../../../lib/admin-session";

const DUMMY_PASSWORD_HASH =
    "$2b$10$nVCpT1y/E07ujsV6QFesru6ExkjVPcM45fKVeORdh3nMk7Hg7GuHG";

function failedLogin() {
    return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
}

function json(data: Record<string, unknown>, init?: ResponseInit) {
    return NextResponse.json(data, {
        ...init,
        headers: { "Cache-Control": "private, no-store", ...init?.headers },
    });
}

export async function POST(request: NextRequest) {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const rateLimit = await consumeRateLimit({
            scope: "admin-login",
            identity: requestIp(request),
            limit: 5,
            windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return json(
                {
                    success: false,
                    message: "Too many login attempts. Try again later.",
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const body = await request.json().catch(() => ({}));
        const email = String(body?.email || "")
            .trim()
            .toLowerCase();
        const password = String(body?.password || "");
        if (!email || !password) {
            return failedLogin();
        }

        await connectDB();
        const user = await User.findOne({ email }).select(
            "+adminTotpSecret +adminTotpEnabled",
        );
        const passwordOk = await bcrypt.compare(
            password,
            user?.password || DUMMY_PASSWORD_HASH,
        );
        if (!user || !passwordOk || !isAdminIdentity(user)) {
            return failedLogin();
        }

        const userId = user._id.toString();
        if (user.adminTotpEnabled && user.adminTotpSecret) {
            const mfaToken = await createAdminMfaToken({
                id: userId,
                stage: "verify",
            });
            // mfaToken is also returned in JSON so verify still works if the
            // browser drops the httpOnly admin_mfa cookie between steps.
            const response = json({
                success: true,
                mfa: "verify",
                mfaToken,
            });
            response.cookies.set(
                ADMIN_MFA_COOKIE,
                mfaToken,
                adminMfaCookieOptions(),
            );
            return response;
        }

        const secret = createTotpSecret();
        const [qrDataUrl, mfaToken] = await Promise.all([
            totpQrDataUrl(secret, user.email),
            createAdminMfaToken({
                id: userId,
                stage: "setup",
                secretEnc: encryptTotpSecret(secret),
            }),
        ]);
        const response = json({
            success: true,
            mfa: "setup",
            qrDataUrl,
            manualKey: secret,
            mfaToken,
        });
        response.cookies.set(
            ADMIN_MFA_COOKIE,
            mfaToken,
            adminMfaCookieOptions(),
        );
        return response;
    } catch (error) {
        console.error("Admin login failed", error);
        return json(
            { success: false, message: "Admin login is unavailable." },
            { status: 500 },
        );
    }
}
