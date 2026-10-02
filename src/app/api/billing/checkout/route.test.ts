import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getStripe: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({ withAuth: (handler: unknown) => handler }));
vi.mock("../../../lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("../../../models/User", () => ({ default: {} }));
vi.mock("../../../lib/plan-config", () => ({ getPlanConfig: vi.fn() }));

import { POST } from "./route";

describe("POST /api/billing/checkout while paid plans are hidden", () => {
    it("starts no subscription, even from an old Pricing tab", async () => {
        const response = await POST({ user: { _id: "u1" } } as never);
        expect(response.status).toBe(404);
        expect((await response.json()).error).toBe("Paid plans aren't available right now.");
        expect(mocks.getStripe).not.toHaveBeenCalled();
    });
});
