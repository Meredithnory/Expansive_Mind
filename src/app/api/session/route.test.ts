import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    resolvePlan: vi.fn(),
    getQuotaSnapshot: vi.fn(),
    isAdminUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../lib/entitlements", () => ({
    resolvePlan: mocks.resolvePlan,
    getQuotaSnapshot: mocks.getQuotaSnapshot,
}));
vi.mock("../../lib/admin", () => ({
    isAdminUser: mocks.isAdminUser,
}));

import { GET } from "./route";

const quotas = {
    discover: { limit: 2, used: 1, remaining: 1 },
    search: { limit: 30, used: 0, remaining: 30 },
};

function authedRequest() {
    const request = new NextRequest("https://example.test/api/session");
    request.user = {
        _id: "user-1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        subscriptionStatus: "active",
    };
    return request;
}

describe("GET /api/session", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolvePlan.mockReturnValue("free");
        mocks.isAdminUser.mockReturnValue(false);
        mocks.getQuotaSnapshot.mockResolvedValue(quotas);
    });

    it("returns the signed-in user, plan, and quota snapshot", async () => {
        const response = await GET(authedRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(body).toEqual({
            authenticated: true,
            user: {
                id: "user-1",
                firstName: "Ada",
                lastName: "Lovelace",
                email: "ada@example.com",
                plan: "free",
                isAdmin: false,
                subscriptionStatus: "active",
            },
            quotas,
        });
        expect(mocks.getQuotaSnapshot).toHaveBeenCalledWith({
            plan: "free",
            identity: "user-1",
            userID: "user-1",
            unlimited: false,
        });
    });

    it("asks for an unlimited snapshot for an admin", async () => {
        mocks.isAdminUser.mockReturnValue(true);
        mocks.resolvePlan.mockReturnValue("pro");

        const response = await GET(authedRequest());
        const body = await response.json();

        expect(body.user.isAdmin).toBe(true);
        expect(body.user.plan).toBe("pro");
        expect(mocks.getQuotaSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({ unlimited: true, plan: "pro" }),
        );
    });

    it("reports subscription status none when the user has none stored", async () => {
        const request = authedRequest();
        request.user.subscriptionStatus = "";

        const body = await (await GET(request)).json();

        expect(body.user.subscriptionStatus).toBe("none");
    });
});
