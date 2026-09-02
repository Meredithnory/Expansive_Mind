import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "./plan-config";
import { summarizeGuestCounters } from "./guest-usage";

describe("summarizeGuestCounters", () => {
    it("groups one IP/network into a single usage row", () => {
        const rows = summarizeGuestCounters(
            [
                {
                    identityHash: "abc123def4567890",
                    feature: "discover",
                    count: 1,
                    updatedAt: "2026-08-26T20:00:00.000Z",
                },
                {
                    identityHash: "abc123def4567890",
                    feature: "search",
                    count: 2,
                    updatedAt: "2026-08-26T21:00:00.000Z",
                },
            ],
            PLAN_ENTITLEMENTS.guest,
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            fingerprint: "abc123def456",
            discoverUsed: 1,
            discoverLimit: 1,
            chatUsed: 0,
            chatLimit: 0,
            searchUsed: 2,
            exhausted: true,
        });
    });

    it("keeps a network unblocked until its Discovery preview is used", () => {
        const rows = summarizeGuestCounters(
            [
                {
                    identityHash: "fff000111222333",
                    feature: "search",
                    count: 1,
                    updatedAt: "2026-08-26T12:00:00.000Z",
                },
            ],
            PLAN_ENTITLEMENTS.guest,
        );

        expect(rows[0].exhausted).toBe(false);
        expect(rows[0].discoverUsed).toBe(0);
    });
});
