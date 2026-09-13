import { describe, expect, it } from "vitest";
import {
    applyDiscoveryQuestionCorrection,
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

describe("applyDiscoveryQuestionCorrection", () => {
    it("fixes subject-term typos without adopting NIH filler-word mistakes", () => {
        expect(
            applyDiscoveryQuestionCorrection(
                "How does marijiana affect aging in young women?",
                "how dose marijuana affect aging in young women",
            ),
        ).toBe("How does marijuana affect aging in young women?");
    });

    it("fixes a typo inside a full question", () => {
        expect(
            applyDiscoveryQuestionCorrection(
                "How to cure post inflammry hyperpigmentation on skin?",
                "How to cure post inflammatory hyperpigmentation on skin?",
            ),
        ).toBe("How to cure post inflammatory hyperpigmentation on skin?");
    });

    it("accepts a full-question rewrite when token counts differ", () => {
        expect(
            applyDiscoveryQuestionCorrection(
                "glp1 recptor agonism in type 2 diabtes",
                "GLP-1 receptor agonism in type 2 diabetes",
            ),
        ).toBe("GLP-1 receptor agonism in type 2 diabetes");
    });
});
