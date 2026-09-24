import { describe, expect, it } from "vitest";
import { getAbstractHighlightTerms } from "./highlight-search";

describe("getAbstractHighlightTerms", () => {
    it("returns terms present in the abstract but missing from the title", () => {
        expect(
            getAbstractHighlightTerms(
                "pigmentary",
                "Advances in animal models of skin disorders",
                "We review pigmentary skin disorders and animal models.",
            ),
        ).toEqual(["pigmentary"]);
    });

    it("skips terms that already appear in the title", () => {
        expect(
            getAbstractHighlightTerms(
                "pigmentary",
                "Advances in animal models of pigmentary skin disorders",
                "We review pigmentary skin disorders and animal models.",
            ),
        ).toEqual([]);
    });

    it("highlights each meaningful multi-word term missing from the title", () => {
        expect(
            getAbstractHighlightTerms(
                "melanoma immunotherapy",
                "Advances in cancer treatment",
                "Melanoma patients respond to immunotherapy in trials.",
            ),
        ).toEqual(["melanoma", "immunotherapy"]);
    });

    it("skips stopwords and tokens under three characters", () => {
        expect(
            getAbstractHighlightTerms(
                "a of in UV",
                "Skin biology overview",
                "UV exposure is a cause of damage in skin.",
            ),
        ).toEqual([]);
    });

    it("requires a whole-word match in the abstract", () => {
        expect(
            getAbstractHighlightTerms(
                "gene",
                "Cancer models",
                "This study examines genetic risk factors.",
            ),
        ).toEqual([]);
    });

    it("is case-insensitive", () => {
        expect(
            getAbstractHighlightTerms(
                "Vitiligo",
                "Pigmentary disorders review",
                "Patients with vitiligo were enrolled.",
            ),
        ).toEqual(["vitiligo"]);
    });
});
