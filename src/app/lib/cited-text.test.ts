import { describe, expect, it } from "vitest";
import {
    evidencePaper,
    normalizeEvidenceCitations,
    parseCitationEvidence,
    splitCitedText,
} from "./cited-text";

const known = new Set(["E1.1", "E1.2", "E3.2", "E6.1"]);

describe("normalizeEvidenceCitations", () => {
    it("rewrites evidence ids as paper citations and keeps which evidence each chip cites", () => {
        const { text, refs } = normalizeEvidenceCitations(
            "Cells fail to persist [E3.2], and exhaustion follows chronic antigen [E1.1, E6.1].",
            10,
            known,
        );
        expect(text).toBe(
            "Cells fail to persist [Paper 3], and exhaustion follows chronic antigen [Papers 1, 6].",
        );
        expect(refs).toEqual(["E3.2", "E1.1", "E6.1"]);
        // The client renders exactly one chip per ref.
        expect(splitCitedText(text, 10).filter((part) => part.type === "cite")).toHaveLength(3);
    });

    it("lines up with plain citations the writer mixed in", () => {
        const { text, refs } = normalizeEvidenceCitations(
            "Trials [Papers 2, 5] and Paper 4 agree; mechanism [E1.2]; see [10].",
            10,
            known,
        );
        expect(text).toBe("Trials [Papers 2, 5] and Paper 4 agree; mechanism [Paper 1]; see [10].");
        expect(refs).toEqual([null, null, null, "E1.2", null]);
    });

    it("keeps the paper but drops an id the extraction never produced", () => {
        const { text, refs } = normalizeEvidenceCitations("Claim [E3.9, Paper 6].", 10, known);
        expect(text).toBe("Claim [Papers 3, 6].");
        expect(refs).toEqual([null, null]);
    });

    it("gives one chip per paper when two ids cite the same paper", () => {
        const { text, refs } = normalizeEvidenceCitations("Claim [E1.1, E1.2].", 10, known);
        expect(text).toBe("Claim [Paper 1].");
        expect(refs).toEqual(["E1.1"]);
    });

    it("drops ids for papers outside the report and leaves other brackets alone", () => {
        expect(normalizeEvidenceCitations("Claim [E14.1] in [2020].", 10, known)).toEqual({
            text: "Claim in [2020].",
            refs: [],
        });
    });

    it("reads the paper from an id", () => {
        expect(evidencePaper("E12.3")).toBe(12);
        expect(evidencePaper("E1")).toBeNull();
    });
});

describe("parseCitationEvidence", () => {
    it("keeps field keys and evidence ids, nulls anything else", () => {
        expect(
            parseCitationEvidence({
                stateOfScience: ["E1.1", null, "junk"],
                "gaps.0.description": ["E4.2"],
                "bad key!": ["E1.1"],
                "gaps.1.title": "not an array",
            }),
        ).toEqual({
            stateOfScience: ["E1.1", null, null],
            "gaps.0.description": ["E4.2"],
        });
        expect(parseCitationEvidence(null)).toBeUndefined();
        expect(parseCitationEvidence([])).toBeUndefined();
    });
});
