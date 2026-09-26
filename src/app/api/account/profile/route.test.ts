import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ updateOne: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../models/User", () => ({ default: { updateOne: mocks.updateOne } }));

import { PATCH } from "./route";

function request(body: unknown, origin = "https://example.test") {
    const next = new NextRequest("https://example.test/api/account/profile", {
        method: "PATCH",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    next.user = { _id: "user-1" };
    return next;
}

describe("PATCH /api/account/profile", () => {
    beforeEach(() => vi.clearAllMocks());

    it("saves a known color for the signed-in user", async () => {
        const response = await PATCH(request({ profileColor: "green" }));
        expect(response.status).toBe(200);
        expect(mocks.updateOne).toHaveBeenCalledWith(
            { _id: "user-1" },
            { $set: { profileColor: "green" } },
        );
    });

    it("rejects an unknown color", async () => {
        const response = await PATCH(request({ profileColor: "#123456" }));
        expect(response.status).toBe(400);
        expect(mocks.updateOne).not.toHaveBeenCalled();
    });

    it("rejects a cross-origin request", async () => {
        const response = await PATCH(
            request({ profileColor: "green" }, "https://evil.example"),
        );
        expect(response.status).toBe(403);
        expect(mocks.updateOne).not.toHaveBeenCalled();
    });
});
