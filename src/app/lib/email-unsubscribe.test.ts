import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
    hasUnsubscribeSecret,
    unsubscribeToken,
    unsubscribeUrl,
    verifyUnsubscribeToken,
} from "./email-unsubscribe";

const USER = "0123456789abcdef01234567";

describe("unsubscribe tokens", () => {
    beforeAll(() => {
        process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret";
    });

    it("signs with its own secret, not the sign-in secret", () => {
        const token = unsubscribeToken(USER);
        const jwt = process.env.JWT_SECRET;
        process.env.JWT_SECRET = "rotated";
        expect(verifyUnsubscribeToken(token)).toBe(USER);
        process.env.JWT_SECRET = jwt;
        expect(hasUnsubscribeSecret()).toBe(true);
    });

    it("round-trips an account id", () => {
        expect(verifyUnsubscribeToken(unsubscribeToken(USER))).toBe(USER);
        expect(new URL(unsubscribeUrl("https://expansivemind.ai", USER)).pathname).toBe("/unsubscribe");
    });

    it("rejects a token for another account or a tampered one", () => {
        const [, sig] = unsubscribeToken(USER).split(".");
        expect(verifyUnsubscribeToken(`${"f".repeat(24)}.${sig}`)).toBeNull();
        expect(verifyUnsubscribeToken(`${USER}.${"A".repeat(43)}`)).toBeNull();
        expect(verifyUnsubscribeToken("nonsense")).toBeNull();
        expect(verifyUnsubscribeToken(null)).toBeNull();
    });
});
