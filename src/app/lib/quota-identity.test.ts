import { afterEach, describe, expect, it } from "vitest";
import { hashQuotaIdentity } from "./quota-identity";

const originalRateLimitSecret = process.env.RATE_LIMIT_SECRET;
const originalJwtSecret = process.env.JWT_SECRET;

describe("hashQuotaIdentity", () => {
    afterEach(() => {
        process.env.RATE_LIMIT_SECRET = originalRateLimitSecret;
        process.env.JWT_SECRET = originalJwtSecret;
    });

    it("returns a stable hex digest that changes with the identity and secret", () => {
        delete process.env.RATE_LIMIT_SECRET;
        process.env.JWT_SECRET = "quota-test-secret";

        const first = hashQuotaIdentity("user-1");
        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(hashQuotaIdentity("user-1")).toBe(first);
        expect(hashQuotaIdentity("user-2")).not.toBe(first);

        process.env.RATE_LIMIT_SECRET = "other-secret";
        expect(hashQuotaIdentity("user-1")).not.toBe(first);
    });

    it("refuses to hash when no secret is configured", () => {
        delete process.env.RATE_LIMIT_SECRET;
        delete process.env.JWT_SECRET;

        expect(() => hashQuotaIdentity("user-1")).toThrow(
            /RATE_LIMIT_SECRET or JWT_SECRET/,
        );
    });
});
