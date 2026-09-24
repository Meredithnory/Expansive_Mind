import { describe, expect, it } from "vitest";
import {
    citationCountSourceLine,
    citationCredibilityNote,
    citationPopularity,
    citationRankReason,
    citationRankingGuide,
    citationSourceLabel,
    formatCitationCount,
    mergePaperImpact,
    normalizePaperDoi,
    normalizePmcid,
    parseCitationCount,
} from "./paper-impact";

describe("paper impact helpers", () => {
    it("normalizes DOIs and PMCIDs", () => {
        expect(normalizePaperDoi("https://doi.org/10.1234/Example")).toBe(
            "10.1234/example",
        );
        expect(normalizePaperDoi('10.1234/x" OR title:*')).toBeUndefined();
        expect(normalizePmcid("PMC12345")).toBe("12345");
        expect(normalizePmcid("https://evil.test")).toBeUndefined();
    });

    it("parses citation counts and prefers registered sources when merging", () => {
        expect(parseCitationCount("1,204")).toBe(1204);
        expect(parseCitationCount(-2)).toBeUndefined();
        expect(
            mergePaperImpact(
                { citationCount: 88, citationSource: "scholar" },
                { citationCount: 41, citationSource: "crossref" },
                { citationCount: 50, citationSource: "europepmc" },
            ),
        ).toEqual({ citationCount: 41, citationSource: "crossref" });
    });

    it("labels popularity as attention, not quality", () => {
        expect(citationPopularity(0)).toEqual({
            level: "none",
            label: "Not yet cited",
        });
        expect(citationPopularity(8).label).toBe("Emerging");
        expect(citationPopularity(240).label).toBe("Highly cited");
        expect(citationRankReason(1)).toBe(
            "Emerging means fewer than 10 citations.",
        );
        expect(citationRankReason(15)).toContain("10 to 49");
        expect(citationRankingGuide()).toBe(
            "1–9 Emerging · 10–49 Cited · 50–199 Widely cited · 200+ Highly cited.",
        );
        expect(formatCitationCount(1)).toBe("1 citation");
        expect(formatCitationCount(1204)).toBe("1,204 citations");
        expect(citationCredibilityNote("crossref")).toContain(
            "not quality or correctness",
        );
        expect(citationCredibilityNote("crossref")).toContain("Crossref");
        expect(citationSourceLabel("scholar")).toBe("Google Scholar");
        expect(citationSourceLabel(undefined)).toBeNull();
        expect(citationCountSourceLine("crossref")).toBe("Count via Crossref");
        expect(citationCountSourceLine(null)).toBe("Count source unknown");
        expect(citationCredibilityNote(undefined)).toContain(
            "Count source unknown",
        );
    });
});
