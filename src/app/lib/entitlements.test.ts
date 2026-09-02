import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    getPlanEntitlements: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../models/UsageCounter", () => ({
    default: {
        find: mocks.find,
    },
}));
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

import { getQuotaSnapshot } from "./entitlements";

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
