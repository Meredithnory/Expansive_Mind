import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
    createAdminMfaToken,
    createAdminSessionToken,
    readAdminMfa,
    readAdminSession,
} from "./admin-session";

const originalSecret = process.env.JWT_SECRET;

describe("admin session", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = "admin-session-test-secret";
    });

    afterEach(() => {
        process.env.JWT_SECRET = originalSecret;
    });

    it("creates a token that only verifies as an admin session", async () => {
        const token = await createAdminSessionToken("owner-1");
        await expect(readAdminSession(token)).resolves.toEqual({ id: "owner-1" });
    });

    it("rejects a normal auth token without an admin role", async () => {
        const token = await new SignJWT({ id: "owner-1" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(process.env.JWT_SECRET));
        await expect(readAdminSession(token)).resolves.toBeNull();
    });

    it("rejects missing or invalid tokens", async () => {
        await expect(readAdminSession()).resolves.toBeNull();
        await expect(readAdminSession("not-a-token")).resolves.toBeNull();
    });

    it("stores a short-lived MFA challenge without treating it as an admin session", async () => {
        const token = await createAdminMfaToken({
            id: "owner-1",
            stage: "setup",
            secretEnc: "enc-secret",
        });
        await expect(readAdminMfa(token)).resolves.toEqual({
            id: "owner-1",
            stage: "setup",
            secretEnc: "enc-secret",
        });
        await expect(readAdminSession(token)).resolves.toBeNull();
    });
});
