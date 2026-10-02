import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findById: vi.fn(),
    getPlanEntitlements: vi.fn(),
    scheduleLimitAlert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../models/UsageCounter", () => ({
    default: {
        find: mocks.find,
        findOneAndUpdate: mocks.findOneAndUpdate,
        findById: mocks.findById,
    },
}));
vi.mock("./limit-alerts", () => ({ scheduleLimitAlert: mocks.scheduleLimitAlert }));
vi.mock("./quota-identity", () => ({
    hashQuotaIdentity: (value: string) => `hash:${value}`,
}));
vi.mock("./plan-config", () => ({
    PLAN_ENTITLEMENTS: {
        guest: { search: 3 },
        free: { search: 20, discover: 2 },
        pro: { search: 300 },
    },
    getPlanEntitlements: mocks.getPlanEntitlements,
    resolvePlan: vi.fn(),
}));

import { consumeQuota, getQuotaSnapshot } from "./entitlements";

describe("quota snapshots", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getPlanEntitlements.mockResolvedValue({
            search: 20,
            discover: 2,
        });
    });

    it("loads all feature counters in one query", async () => {
        let queriedIds: string[] = [];
        mocks.find.mockImplementation((query) => {
            queriedIds = query._id.$in;
            return {
                select: () => ({
                    lean: () =>
                        Promise.resolve([
                            { _id: queriedIds[0], count: 7 },
                        ]),
                }),
            };
        });

        const snapshot = await getQuotaSnapshot({
            plan: "free",
            identity: "user-1",
        });

        expect(mocks.find).toHaveBeenCalledTimes(1);
        expect(queriedIds).toHaveLength(2);
        expect(snapshot).toEqual({
            search: { limit: 20, used: 7, remaining: 13 },
            discover: { limit: 2, used: 0, remaining: 2 },
        });
    });
});

describe("limit alerts from consumeQuota", () => {
    const counter = (count: number | null) => ({ lean: () => Promise.resolve(count === null ? null : { count }) });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getPlanEntitlements.mockResolvedValue({ discover: 5, search: 20 });
    });

    it("stays quiet before the last one", async () => {
        mocks.findOneAndUpdate.mockReturnValue(counter(4));
        const result = await consumeQuota({ plan: "free", feature: "discover", identity: "u1", userID: "u1" });
        expect(result).toMatchObject({ allowed: true, remaining: 1 });
        expect(mocks.scheduleLimitAlert).not.toHaveBeenCalled();
    });

    it("flags the person when they use their last one", async () => {
        mocks.findOneAndUpdate.mockReturnValue(counter(5));
        await consumeQuota({ plan: "free", feature: "discover", identity: "u1", userID: "u1" });
        expect(mocks.scheduleLimitAlert).toHaveBeenCalledWith(
            expect.objectContaining({ userID: "u1", feature: "discover", limit: 5, used: 5, blocked: false }),
        );
    });

    it("flags a retry after running out", async () => {
        mocks.findOneAndUpdate.mockReturnValue(counter(null));
        mocks.findById.mockReturnValue(counter(5));
        const result = await consumeQuota({ plan: "free", feature: "discover", identity: "u1", userID: "u1" });
        expect(result).toMatchObject({ allowed: false, used: 5 });
        expect(mocks.scheduleLimitAlert).toHaveBeenCalledWith(expect.objectContaining({ blocked: true }));
    });

    it("never flags guests or admins", async () => {
        mocks.findOneAndUpdate.mockReturnValue(counter(1));
        mocks.getPlanEntitlements.mockResolvedValue({ discover: 1 });
        await consumeQuota({ plan: "guest", feature: "discover", identity: "ip-hash" });
        await consumeQuota({ plan: "free", feature: "discover", identity: "admin", userID: "admin", unlimited: true });
        expect(mocks.scheduleLimitAlert).not.toHaveBeenCalled();
    });
});
