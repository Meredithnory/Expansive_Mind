import { describe, expect, it } from "vitest";
import {
    PASSWORD_RESET_EMAIL_THEME,
    PASSWORD_RESET_TTL_MS,
    buildPasswordResetLink,
    createPasswordResetToken,
    hashPasswordResetToken,
    isPasswordResetToken,
    normalizeAccountEmail,
    normalizeNewPassword,
    passwordResetFromAddress,
    passwordResetHtml,
    passwordResetSubject,
    passwordResetText,
} from "./password-reset";

describe("password reset tokens and copy", () => {
    it("normalizes an account email and rejects a bad one", () => {
        expect(normalizeAccountEmail("  Ada@Example.com ")).toBe(
            "ada@example.com",
        );
        expect(normalizeAccountEmail("not-an-email")).toBeNull();
        expect(normalizeAccountEmail("")).toBeNull();
    });

    it("accepts the same password length as a signed-in password change", () => {
        expect(normalizeNewPassword("  secret  ")).toBe("secret");
        expect(normalizeNewPassword("short")).toBeNull();
        expect(normalizeNewPassword("x".repeat(129))).toBeNull();
    });

    it("creates a single-use token and stores only its hash", () => {
        const token = createPasswordResetToken();
        const hash = hashPasswordResetToken(token);

        expect(isPasswordResetToken(token)).toBe(true);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).not.toBe(token);
        expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
    });

    it("builds one reset link", () => {
        const link = buildPasswordResetLink(
            "https://example.test",
            "abc",
        );
        expect(link).toBe("https://example.test/reset-password?token=abc");
    });

    it("themes the email like the login card and does not include a new password", () => {
        const link = "https://example.test/reset-password?token=once";
        const html = passwordResetHtml(link, 2026);
        const text = passwordResetText(link, 2026);
        const theme = PASSWORD_RESET_EMAIL_THEME;

        expect(passwordResetSubject()).toBe(
            "Reset your Expansive Mind password",
        );
        expect(html).toContain(theme.background);
        expect(html).toContain(theme.pink);
        expect(html).toContain(theme.text);
        expect(html).toContain(theme.font.split(",")[0]);
        expect(html).toContain("Choose a new password");
        expect(html).toContain("© 2026 Expansive Mind. All rights reserved.");
        expect(text).toContain(link);
        expect(text).toContain("expires in one hour");
        expect(text).not.toMatch(/new password is/i);

        const urls = html.match(/https:\/\/example\.test\/reset-password\?token=[^"<&]+/g);
        expect(urls?.length).toBeGreaterThan(0);
        expect(new Set(urls)).toEqual(new Set([link]));
    });

    it("uses the contact from-address, with the same Resend fallback", () => {
        expect(passwordResetFromAddress({ CONTACT_FROM_EMAIL: "Expansive Mind <hi@example.com>" })).toBe(
            "Expansive Mind <hi@example.com>",
        );
        expect(passwordResetFromAddress({})).toBe(
            "Expansive Mind <beth.t@example.com>",
        );
    });
});
