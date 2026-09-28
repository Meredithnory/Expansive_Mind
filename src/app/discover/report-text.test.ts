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

describe("splitCitedText with grouped and numeric citations", () => {
    const labels = (text: string, count = 10) =>
        splitCitedText(text, count).map((segment) =>
            segment.type === "cite" ? `<${segment.index}>` : segment.value,
        ).join("");

    it("turns every paper in a group into its own chip", () => {
        expect(labels("reviews [Papers 2, 5], trade [Paper 3]")).toBe(
            "reviews <2> <5>, trade <3>",
        );
        expect(labels("studies [Papers 1, 6, and 10].")).toBe("studies <1> <6> <10>.");
        expect(labels("Papers 7 and 8 agree")).toBe("<7> <8> agree");
    });

    it("reads bare bracketed numbers and ranges", () => {
        expect(labels("persist [10], exhaustion [1,6,9], stroma [2,3].")).toBe(
            "persist <10>, exhaustion <1> <6> <9>, stroma <2> <3>.",
        );
        expect(labels("across [Papers 7–9]")).toBe("across <7> <8> <9>");
    });

    it("keeps brackets that aren't paper citations", () => {
        expect(labels("in [2020] and [Papers 2, 14]", 10)).toBe(
            "in [2020] and [Papers 2, 14]",
        );
        expect(labels("Paper 3, 4 patients", 10)).toBe("<3>, 4 patients");
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
