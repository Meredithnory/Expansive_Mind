import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOTP, Secret } from "otpauth";

vi.mock("server-only", () => ({}));
import {
    createTotpSecret,
    decryptTotpSecret,
    encryptTotpSecret,
    totpKeyUri,
    verifyTotpCode,
} from "./admin-totp";

const originalSecret = process.env.JWT_SECRET;

describe("admin TOTP", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = "admin-totp-test-secret";
    });

    afterEach(() => {
        process.env.JWT_SECRET = originalSecret;
    });

    it("round-trips an encrypted authenticator secret", () => {
        const secret = createTotpSecret();
        const encrypted = encryptTotpSecret(secret);
        expect(encrypted).not.toContain(secret);
        expect(decryptTotpSecret(encrypted)).toBe(secret);
    });

    it("accepts a current authenticator code and rejects reuse", () => {
        const secret = createTotpSecret();
        const at = new Date("2026-09-14T07:40:00.000Z");
        const code = new TOTP({
            issuer: "Expansive Mind Admin",
            label: "owner@example.com",
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: Secret.fromBase32(secret),
        }).generate({ timestamp: at.getTime() });

        const first = verifyTotpCode({
            secret,
            label: "owner@example.com",
            code,
            at,
        });
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(
            verifyTotpCode({
                secret,
                label: "owner@example.com",
                code,
                lastStep: first.step,
                at,
            }).ok,
        ).toBe(false);
    });

    it("rejects a malformed code", () => {
        const secret = createTotpSecret();
        expect(
            verifyTotpCode({
                secret,
                label: "owner@example.com",
                code: "12ab",
            }).ok,
        ).toBe(false);
        expect(totpKeyUri(secret, "owner@example.com")).toContain(
            "otpauth://totp/",
        );
    });
});
