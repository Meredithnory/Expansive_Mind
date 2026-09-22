import { NextRequest, NextResponse } from "next/server";
import User from "../../../../models/User";
import connectDB from "../../../../db/connectDB";
import { consumeRateLimit, requestIp } from "../../../../lib/rate-limit";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { isAdminIdentity } from "../../../../lib/admin-identity";
import { recordAdminAction } from "../../../../lib/admin-audit";
import {
    decryptTotpSecret,
    encryptTotpSecret,
    verifyTotpCode,
} from "../../../../lib/admin-totp";
import {
    ADMIN_MFA_COOKIE,
    ADMIN_SESSION_COOKIE,
    AUTH_COOKIE,
    adminLoginTokens,
    adminMfaCookieOptions,
    adminSessionCookieOptions,
    authCookieOptions,
    readAdminMfaFromRequest,
} from "../../../../lib/admin-session";

function json(data: Record<string, unknown>, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "private, no-store" },
    });
}

export async function POST(request: NextRequest) {
    try {
        if (!hasValidMutationOrigin(request)) {
            return json({ error: "Invalid origin." }, 403);
        }

        const pending = await readAdminMfaFromRequest(request);
        if (!pending) {
            return json(
                { success: false, message: "Sign in with your password first." },
                401,
            );
        }

        const rateLimit = await consumeRateLimit({
            scope: "admin-totp",
            identity: `${requestIp(request)}:${pending.id}`,
            limit: 8,
            windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return json(
                {
                    success: false,
                    message: "Too many code attempts. Try again later.",
                },
                429,
            );
        }

        const body = await request.json().catch(() => ({}));
        const code = String(body?.code || "");

        await connectDB();
        const user = await User.findById(pending.id).select(
            "+adminTotpSecret +adminTotpEnabled +adminTotpLastStep",
        );
        if (!user || !isAdminIdentity(user)) {
            return json(
                { success: false, message: "Invalid authentication code." },
                401,
            );
        }

        const secret =
            pending.stage === "setup"
                ? pending.secretEnc
                    ? decryptTotpSecret(pending.secretEnc)
                    : ""
                : user.adminTotpSecret
                  ? decryptTotpSecret(user.adminTotpSecret)
                  : "";
        const verified = secret
            ? verifyTotpCode({
                  secret,
                  label: user.email,
                  code,
                  lastStep: user.adminTotpLastStep,
              })
            : { ok: false as const };
        if (!verified.ok) {
            return json(
                { success: false, message: "Invalid authentication code." },
                401,
            );
        }

        const userId = user._id.toString();
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    adminTotpEnabled: true,
                    adminTotpSecret: encryptTotpSecret(secret),
                    adminTotpLastStep: verified.step,
                },
            },
        );

        const { authToken, adminToken } = await adminLoginTokens(userId);
        await recordAdminAction({
            adminEmail: user.email,
            action:
                pending.stage === "setup" ? "admin.totp.enabled" : "admin.login",
            target: userId,
        });
        if (pending.stage === "setup") {
            await recordAdminAction({
                adminEmail: user.email,
                action: "admin.login",
                target: userId,
            });
        }

        const response = json({ success: true });
        response.cookies.set(AUTH_COOKIE, authToken, authCookieOptions());
        response.cookies.set(
            ADMIN_SESSION_COOKIE,
            adminToken,
            adminSessionCookieOptions(),
        );
        response.cookies.set(
            ADMIN_MFA_COOKIE,
            "",
            adminMfaCookieOptions(0),
        );
        return response;
    } catch (error) {
        console.error("Admin TOTP verification failed", error);
        return json(
            { success: false, message: "Admin login is unavailable." },
            500,
        );
    }
}
