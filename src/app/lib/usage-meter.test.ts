import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../models/UsageEvent", () => ({ default: { create: vi.fn() } }));
vi.mock("./quota-identity", () => ({
    hashQuotaIdentity: (value: string) => value,
}));

import { estimateAiCostMicros } from "./usage-meter";

describe("estimateAiCostMicros", () => {
    it("prices claude sonnet 4.5 at Anthropic's standard list rate", () => {
        expect(
            estimateAiCostMicros({
                model: "anthropic/claude-sonnet-4.5",
                inputTokens: 1_000_000,
            }),
        ).toBe(3_000_000);
        expect(
            estimateAiCostMicros({
                model: "anthropic/claude-sonnet-4.5",
                outputTokens: 1_000_000,
            }),
        ).toBe(15_000_000);
        expect(
            estimateAiCostMicros({
                model: "anthropic/claude-sonnet-4.5",
                inputTokens: 1_000,
                outputTokens: 500,
            }),
        ).toBe(1_000 * 3 + 500 * 15);
    });

    it("returns zero when the model has no listed rate", () => {
        expect(
            estimateAiCostMicros({
                model: "anthropic/claude-unknown",
                inputTokens: 1_000_000,
                outputTokens: 1_000_000,
            }),
        ).toBe(0);
    });
});
