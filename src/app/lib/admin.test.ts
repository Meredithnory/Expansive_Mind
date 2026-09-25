import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("../api/authMiddleware", () => ({
    withAuth:
        (handler: (request: NextRequest) => Promise<NextResponse>) =>
        async (request: NextRequest) => {
            request.user = { email: "member@example.test" };
            return handler(request);
        },
}));

import { withAdmin } from "./admin";

const originalAdminEmails = process.env.ADMIN_EMAILS;

describe("withAdmin", () => {
    afterEach(() => {
        process.env.ADMIN_EMAILS = originalAdminEmails;
    });

    it("returns 403 when the current user is not allowlisted", async () => {
        process.env.ADMIN_EMAILS = "owner@example.test";
        const handler = vi.fn(async () => NextResponse.json({ ok: true }));
        const response = await withAdmin(handler)(
            new NextRequest("https://example.test/api/admin/users"),
        );

        expect(response.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
    });
});
