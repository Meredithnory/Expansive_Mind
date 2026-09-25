import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    ADMIN_MFA_CHALLENGE_KEY,
    adminMfaChallengeForSubmit,
    readStoredAdminMfaChallenge,
    storeAdminMfaChallenge,
} from "./mfa-challenge";

function memoryStorage() {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
        removeItem: (key: string) => {
            values.delete(key);
        },
    };
}

describe("admin MFA challenge", () => {
    it("keeps the password-step challenge when authenticator state was cleared", () => {
        const storage = memoryStorage();
        storeAdminMfaChallenge(storage, "signed-challenge");

        expect(
            adminMfaChallengeForSubmit({
                stateToken: "",
                storedToken: readStoredAdminMfaChallenge(storage),
            }),
        ).toBe("signed-challenge");
        expect(storage.getItem(ADMIN_MFA_CHALLENGE_KEY)).toBe(
            "signed-challenge",
        );
    });

    it("prefers the in-memory challenge over storage", () => {
        expect(
            adminMfaChallengeForSubmit({
                stateToken: "current",
                storedToken: "stored",
            }),
        ).toBe("current");
    });

    it("leaves the authenticator step by a full navigation, not a cached router refresh", () => {
        const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
        const mfaForm = page.slice(page.indexOf('key="admin-mfa"'));

        expect(page).toContain('window.location.assign("/admin")');
        expect(page).toContain("adminMfaChallengeForSubmit");
        expect(page).not.toContain("router.refresh(");
        expect(page).not.toContain("router.push(");
        expect(mfaForm.length).toBeGreaterThan(0);
        expect(mfaForm).not.toContain("styles.password");
    });
});
