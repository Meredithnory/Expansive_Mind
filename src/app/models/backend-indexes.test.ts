import { describe, expect, it } from "vitest";
import Message from "./Message";
import SavedPaper from "./SavedPaper";
import UsageEvent from "./UsageEvent";

function hasIndex(
    indexes: ReturnType<typeof Message.schema.indexes>,
    expected: Record<string, number>,
) {
    return indexes.some(([fields]) => JSON.stringify(fields) === JSON.stringify(expected));
}

describe("backend query indexes", () => {
    it("supports recent paper message and saved-paper lookups", () => {
        expect(
            hasIndex(Message.schema.indexes(), {
                savedPaperID: 1,
                createdAt: -1,
            }),
        ).toBe(true);
        expect(
            hasIndex(SavedPaper.schema.indexes(), {
                userID: 1,
                createdAt: -1,
            }),
        ).toBe(true);
    });

    it("supports aggregate usage filtering", () => {
        expect(
            hasIndex(UsageEvent.schema.indexes(), {
                occurredAt: -1,
                feature: 1,
                provider: 1,
            }),
        ).toBe(true);
    });
});
