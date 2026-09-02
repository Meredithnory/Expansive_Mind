import { describe, expect, it } from "vitest";
import {
    applyDiscoverySpellingSuggestion,
    buildNihDiscoveryQuery,
} from "./discovery-query";

describe("buildNihDiscoveryQuery", () => {
    it("removes question filler words that make PMC searches too strict", () => {
        expect(
            buildNihDiscoveryQuery(
                "How does marijuana affect aging in young women?",
            ),
        ).toBe("marijuana aging young women");
    });

    it("keeps corrected subject terms without introducing corrected filler words", () => {
        expect(
            applyDiscoverySpellingSuggestion(
                "How does marijiana affect aging in young women?",
                "how dose marijuana affect aging in young women",
            ),
        ).toBe("marijuana aging young women");
    });
});
