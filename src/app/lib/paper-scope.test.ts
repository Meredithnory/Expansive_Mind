import { describe, expect, it } from "vitest";
import { narrowerScope, scopeLabel } from "./paper-scope";

describe("narrowerScope", () => {
    it("flags a paper limited to a group the question never named", () => {
        expect(
            narrowerScope(
                "How are off-target effects of gene editing assessed?",
                "genome-edited livestock (cattle, pigs, sheep, goats) across 128 studies",
            ),
        ).toBe("genome-edited livestock (cattle, pigs, sheep, goats) across 128 studies");
        expect(
            narrowerScope(
                "Does GLP-1 agonism reduce cardiovascular events?",
                "diet-induced obese mice",
            ),
        ).toBe("diet-induced obese mice");
        expect(
            narrowerScope("Does drug X slow tumor growth?", "HeLa and HEK293 cell lines"),
        ).toBe("HeLa and HEK293 cell lines");
    });

    it("says nothing when the paper studied what was asked", () => {
        expect(
            narrowerScope(
                "Off-target effects of gene editing in livestock",
                "genome-edited cattle and pigs",
            ),
        ).toBeNull();
        expect(
            narrowerScope("Which animal models best predict toxicity?", "rats and dogs"),
        ).toBeNull();
        expect(
            narrowerScope(
                "Does GLP-1 agonism reduce cardiovascular events?",
                "adults with type 2 diabetes",
            ),
        ).toBeNull();
        expect(narrowerScope("Any question", undefined)).toBeNull();
        expect(narrowerScope("Any question", "  ")).toBeNull();
    });
});

describe("scopeLabel", () => {
    it("collapses whitespace and cuts a long population on a word", () => {
        expect(scopeLabel("  adults   over 65 ")).toBe("adults over 65");
        const long = scopeLabel(`adults ${"with long-standing type 2 diabetes ".repeat(5)}`);
        expect(long.length).toBeLessThanOrEqual(91);
        expect(long.endsWith("…")).toBe(true);
    });
});
