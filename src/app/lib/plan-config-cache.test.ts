import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    connectDB: vi.fn(),
    findById: vi.fn(),
}));

vi.mock("../db/connectDB", () => ({ default: mocks.connectDB }));
vi.mock("../models/PlanConfig", () => ({
    default: { findById: mocks.findById },
}));

describe("plan configuration cache", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.findById.mockReturnValue({
            lean: () => Promise.resolve(null),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("briefly reuses only the global plan configuration", async () => {
        const { getPlanConfig } = await import("./plan-config");

        const first = await getPlanConfig();
        const second = await getPlanConfig();
        expect(mocks.findById).toHaveBeenCalledTimes(1);
        expect(second).toEqual(first);
        expect(second).not.toBe(first);

        vi.advanceTimersByTime(15_001);
        await getPlanConfig();
        expect(mocks.findById).toHaveBeenCalledTimes(2);
    });

    it("can be invalidated immediately after an admin update", async () => {
        const { clearPlanConfigCache, getPlanConfig } =
            await import("./plan-config");

        await getPlanConfig();
        clearPlanConfigCache();
        await getPlanConfig();
        expect(mocks.findById).toHaveBeenCalledTimes(2);
    });
});
