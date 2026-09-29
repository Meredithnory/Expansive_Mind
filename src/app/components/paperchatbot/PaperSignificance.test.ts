import { describe, expect, it } from "vitest";
import { significancePoints } from "./PaperSignificance";

describe("significancePoints", () => {
    it("uses the paper's own paragraphs when there are a few", () => {
        expect(significancePoints("A. B.", ["What is known.", "What this adds."])).toEqual([
            "What is known.",
            "What this adds.",
        ]);
    });

    it("splits a single paragraph into its sentences", () => {
        expect(
            significancePoints("GLP-1RAs reduce MACE by 13–20%. Uptake remains 8-14% of patients."),
        ).toEqual(["GLP-1RAs reduce MACE by 13–20%.", "Uptake remains 8-14% of patients."]);
    });

    it("keeps a paragraph whole when an abbreviation would split it", () => {
        expect(significancePoints("Shown by Smith et al. Results held in Fig. 2 as well.")).toBeNull();
    });

    it("keeps one sentence, or very many, as a paragraph", () => {
        expect(significancePoints("Only one point here.")).toBeNull();
        expect(significancePoints("A one. B two. C three. D four. E five. F six. G seven.")).toBeNull();
    });
});
