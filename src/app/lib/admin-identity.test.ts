import { describe, expect, it } from "vitest";
import {
    configuredAdminEmails,
    isAdminIdentity,
} from "./admin-identity";

describe("admin identity", () => {
    it("normalizes a comma-separated email allowlist", () => {
        expect(configuredAdminEmails(" Owner@Example.com, support@example.com ")).toEqual([
            "owner@example.com",
            "support@example.com",
        ]);
    });

    it("matches only configured user emails", () => {
        const configured = "owner@example.com";
        expect(isAdminIdentity({ email: "OWNER@example.com" }, configured)).toBe(true);
        expect(isAdminIdentity({ email: "user@example.com" }, configured)).toBe(false);
        expect(isAdminIdentity(null, configured)).toBe(false);
    });
});
