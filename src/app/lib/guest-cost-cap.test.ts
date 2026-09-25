import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { consumeRateLimit } = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
}));
vi.mock("./rate-limit", () => ({
    consumeRateLimit,
    requestIp: () => "203.0.113.10",
}));

import {
    consumeGuestDailyCap,
    guestDailyLimit,
} from "./guest-cost-cap";

describe("guest daily provider caps", () => {
    beforeEach(() => {
        consumeRateLimit.mockReset();
    });

    it("uses a durable 24-hour bucket keyed by the request IP", async () => {
        consumeRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 120,
        });

        const result = await consumeGuestDailyCap(
            new Request("https://example.test/api/paper"),
            "paper",
        );

        expect(result.allowed).toBe(false);
        expect(consumeRateLimit).toHaveBeenCalledWith({
            scope: "guest-daily-paper",
            identity: "203.0.113.10",
            limit: 12,
            windowMs: 24 * 60 * 60 * 1_000,
        });
    });

    it("keeps the first Discovery preview within the daily cap", () => {
        expect(guestDailyLimit("discover")).toBe(1);
    });
});
