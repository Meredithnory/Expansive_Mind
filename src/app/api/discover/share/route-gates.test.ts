import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../models/SavedDiscovery", () => ({
    default: { findOne: mocks.findOne },
}));

import { POST } from "./route";

const userId = { toString: () => "user-1" };

function request(body: unknown, origin = "https://example.test") {
    const next = new NextRequest("https://example.test/api/discover/share", {
        method: "POST",
        headers: {
            origin,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
    next.user = { _id: userId };
    return next;
}

describe("POST /api/discover/share gates", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("rejects a cross-origin share", async () => {
        const response = await POST(
            request({ id: "64a1b2c3d4e5f6a7b8c9d0e1" }, "https://evil.example"),
        );

        expect(response.status).toBe(403);
        expect(mocks.findOne).not.toHaveBeenCalled();
    });

    it("rejects an id that is not a Mongo id", async () => {
        const response = await POST(request({ id: "not-an-id" }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("A valid discovery ID is required.");
        expect(mocks.findOne).not.toHaveBeenCalled();
    });

    it("returns 500 when the lookup throws", async () => {
        mocks.findOne.mockRejectedValue(new Error("db down"));

        const response = await POST(
            request({ id: "64a1b2c3d4e5f6a7b8c9d0e1" }),
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe("Unable to create a share link.");
    });
});
