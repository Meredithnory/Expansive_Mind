import { describe, expect, it } from "vitest";
import { splitCitedText, splitParagraphs } from "./report-text";

describe("splitCitedText", () => {
    it("turns [Paper N] mentions into citation chips", () => {
        expect(
            splitCitedText(
                "Agonists reduce events [Paper 1] in adults [Paper 3].",
                4,
            ),
        ).toEqual([
            { type: "text", value: "Agonists reduce events " },
            { type: "cite", index: 1, label: "Paper 1" },
            { type: "text", value: " in adults " },
            { type: "cite", index: 3, label: "Paper 3" },
            { type: "text", value: "." },
        ]);
    });

    it("also links bare Paper N mentions used in older briefs", () => {
        expect(splitCitedText("See Paper 2 · Lee for the protocol.", 3)).toEqual(
            [
                { type: "text", value: "See " },
                { type: "cite", index: 2, label: "Paper 2" },
                { type: "text", value: " · Lee for the protocol." },
            ],
        );
    });

    it("leaves out-of-range mentions as plain text", () => {
        expect(splitCitedText("Claimed in [Paper 9] and Paper 0.", 2)).toEqual([
            { type: "text", value: "Claimed in [Paper 9] and Paper 0." },
        ]);
    });
});

describe("splitParagraphs", () => {
    it("splits on newlines and drops empty lines", () => {
        expect(splitParagraphs("First.\n\nSecond.\n")).toEqual([
            "First.",
            "Second.",
        ]);
    });
});
