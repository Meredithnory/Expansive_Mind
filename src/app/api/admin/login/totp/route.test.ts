import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    findById: vi.fn(),
    updateOne: vi.fn(),
    connectDB: vi.fn(),
    recordAdminAction: vi.fn(),
    isAdminIdentity: vi.fn(),
    verifyTotpCode: vi.fn(),
    decryptTotpSecret: vi.fn(),
    encryptTotpSecret: vi.fn(),
    adminLoginTokens: vi.fn(),
}));

vi.mock("../../../../db/connectDB", () => ({ default: mocks.connectDB }));
vi.mock("../../../../models/User", () => ({
    default: {
        findById: mocks.findById,
        updateOne: mocks.updateOne,
    },
}));
vi.mock("../../../../lib/rate-limit", () => ({
    consumeRateLimit: () =>
        Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
    requestIp: () => "127.0.0.1",
}));
vi.mock("../../../../lib/request-security", () => ({
    hasValidMutationOrigin: () => true,
}));
vi.mock("../../../../lib/admin-identity", () => ({
    isAdminIdentity: mocks.isAdminIdentity,
}));
vi.mock("../../../../lib/admin-audit", () => ({
    recordAdminAction: mocks.recordAdminAction,
}));
vi.mock("../../../../lib/admin-totp", () => ({
    decryptTotpSecret: mocks.decryptTotpSecret,
    encryptTotpSecret: mocks.encryptTotpSecret,
    verifyTotpCode: mocks.verifyTotpCode,
}));
vi.mock("../../../../lib/admin-session", async () => {
    const actual = await vi.importActual<
        typeof import("../../../../lib/admin-session")
    >("../../../../lib/admin-session");
    return {
        ...actual,
        adminLoginTokens: mocks.adminLoginTokens,
    };
});

import { POST } from "./route";
import {
    ADMIN_MFA_COOKIE,
    createAdminMfaToken,
} from "../../../../lib/admin-session";

const originalSecret = process.env.JWT_SECRET;

function totpRequest(input: {
    code?: string;
    mfaToken?: string;
    cookie?: string;
}) {
    const headers = new Headers({
        "content-type": "application/json",
        origin: "https://www.expansivemind.ai",
    });
    if (input.cookie) {
        headers.set("cookie", `${ADMIN_MFA_COOKIE}=${input.cookie}`);
    }
    return new NextRequest("https://www.expansivemind.ai/api/admin/login/totp", {
        method: "POST",
        headers,
        body: JSON.stringify({
            code: input.code ?? "123456",
            ...(input.mfaToken ? { mfaToken: input.mfaToken } : {}),
        }),
    });
}

describe("POST /api/admin/login/totp", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = "admin-totp-route-test-secret";
        vi.clearAllMocks();
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.isAdminIdentity.mockReturnValue(true);
        mocks.decryptTotpSecret.mockReturnValue("DECRYPTEDSECRET");
        mocks.encryptTotpSecret.mockImplementation((value: string) => `enc:${value}`);
        mocks.verifyTotpCode.mockReturnValue({ ok: true, step: 42 });
        mocks.adminLoginTokens.mockResolvedValue({
            authToken: "auth-token",
            adminToken: "admin-token",
        });
        mocks.recordAdminAction.mockResolvedValue(undefined);
        mocks.updateOne.mockResolvedValue({ acknowledged: true });
        mocks.findById.mockReturnValue({
            select: () =>
                Promise.resolve({
                    _id: { toString: () => "owner-1" },
                    email: "admin@example.com",
                    adminTotpSecret: "stored-enc",
                    adminTotpEnabled: false,
                    adminTotpLastStep: null,
                }),
        });
    });

    afterEach(() => {
        process.env.JWT_SECRET = originalSecret;
    });

    it("returns the password-first error when neither cookie nor body token is present", async () => {
        const response = await POST(totpRequest({ code: "123456" }));
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.message).toBe("Sign in with your password first.");
        expect(mocks.connectDB).not.toHaveBeenCalled();
    });

    it("accepts the password-step mfaToken from the body when the cookie is missing", async () => {
        const mfaToken = await createAdminMfaToken({
            id: "owner-1",
            stage: "setup",
            secretEnc: "setup-enc",
        });
        const response = await POST(
            totpRequest({ code: "123456", mfaToken }),
        );
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mocks.verifyTotpCode).toHaveBeenCalled();
        expect(mocks.adminLoginTokens).toHaveBeenCalledWith("owner-1");
    });

    it("uses the password-step body challenge when a stale cookie is also present", async () => {
        const stale = await createAdminMfaToken({
            id: "owner-1",
            stage: "setup",
            secretEnc: "stale-enc",
        });
        const current = await createAdminMfaToken({
            id: "owner-1",
            stage: "setup",
            secretEnc: "current-enc",
        });
        const response = await POST(
            totpRequest({ code: "123456", mfaToken: current, cookie: stale }),
        );
        expect(response.status).toBe(200);
        expect(mocks.decryptTotpSecret).toHaveBeenCalledWith("current-enc");
    });

    it("rejects a wrong code without a password-failure status", async () => {
        mocks.verifyTotpCode.mockReturnValue({ ok: false });
        const mfaToken = await createAdminMfaToken({
            id: "owner-1",
            stage: "verify",
        });
        const response = await POST(
            totpRequest({ code: "000000", mfaToken }),
        );
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.message).toBe("Invalid authentication code.");
        expect(mocks.adminLoginTokens).not.toHaveBeenCalled();
    });
});
