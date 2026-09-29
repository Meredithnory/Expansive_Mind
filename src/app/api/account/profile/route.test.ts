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

    it("saves a known coat color for the signed-in user", async () => {
        const response = await PATCH(request({ profileColor: "green" }));
        expect(response.status).toBe(200);
        expect(mocks.updateOne).toHaveBeenCalledWith(
            { _id: "user-1" },
            { $set: { profileColor: "green" } },
            { runValidators: true },
        );
    });

    it("saves only the badge fields sent, cleaned, plus the bio", async () => {
        const response = await PATCH(
            request({
                profileColor: "white",
                badge: { role: "Enthusiast", field: "  Immuno\u0000logy  ", head: "gradcap", sidekick: "mouse" },
                bio: "Line one\r\n\r\n\r\nLine two",
            }),
        );
        expect(response.status).toBe(200);
        expect(mocks.updateOne).toHaveBeenCalledWith(
            { _id: "user-1" },
            {
                $set: {
                    profileColor: "white",
                    "badge.role": "Enthusiast",
                    "badge.field": "Immuno logy",
                    "badge.head": "gradcap",
                    "badge.sidekick": "mouse",
                    bio: "Line one\n\nLine two",
                },
            },
            { runValidators: true },
        );
    });

    it("lets a reader clear their role", async () => {
        const response = await PATCH(request({ badge: { role: null } }));
        expect(response.status).toBe(200);
        expect(mocks.updateOne.mock.calls[0][1]).toEqual({ $set: { "badge.role": null } });
    });

    it.each([
        [{ profileColor: "#123456" }],
        [{ badge: { role: "Wizard" } }],
        [{ badge: { head: "crown" } }],
        [{ badge: "goggles" }],
        [{ bio: 42 }],
        [{}],
    ])("rejects %j without writing", async (body) => {
        const response = await PATCH(request(body));
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
