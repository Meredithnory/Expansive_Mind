import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import {
    ADMIN_MFA_COOKIE,
    ADMIN_SESSION_COOKIE,
    AUTH_COOKIE,
} from "../../lib/admin-session";

function logoutRequest(origin?: string) {
    return new NextRequest("https://example.test/api/logout", {
        method: "POST",
        headers: origin ? { origin } : { "sec-fetch-site": "cross-site" },
    });
}

function setCookies(response: Response) {
    const headers = response.headers as Headers & {
        getSetCookie?: () => string[];
    };
    return typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : [response.headers.get("set-cookie") ?? ""];
}

describe("POST /api/logout", () => {
    it("rejects a cross-origin logout and does not clear cookies", async () => {
        const response = await POST(logoutRequest("https://evil.example"));

        expect(response.status).toBe(403);
        expect(setCookies(response).join("")).not.toContain(AUTH_COOKIE);
    });

    it("clears the auth cookie and both admin cookies", async () => {
        const response = await POST(logoutRequest("https://example.test"));
        const cookies = setCookies(response).join("\n");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        for (const name of [AUTH_COOKIE, ADMIN_SESSION_COOKIE, ADMIN_MFA_COOKIE]) {
            expect(cookies).toContain(`${name}=`);
        }
        expect(cookies).toMatch(/Max-Age=0/i);
        expect(cookies).toContain("HttpOnly");
        expect(cookies).toContain("SameSite=strict");
    });
});
