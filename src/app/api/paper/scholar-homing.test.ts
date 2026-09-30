import { describe, expect, it, vi } from "vitest";
import type { FormattedPaper } from "../general-interfaces";
import { homeScholarResult } from "./scholar-homing";

function paper(source: string, sections: string[]): FormattedPaper {
    return {
        title: "Off-target effects in CRISPR/Cas9 gene editing",
        authors: ["Guo, C"],
        paperId: source === "nih" ? "10034092" : "10.1007/x",
        idName: source === "nih" ? "pmcid" : "doi",
        primarySource: source === "nih" ? "NIH PubMed Central" : "Springer Nature",
        source,
        paper: sections.map((title) => ({ title, content: `${title} text`, subSections: [] })),
        access: {} as FormattedPaper["access"],
    };
}

function deps(overrides: Partial<Parameters<typeof homeScholarResult>[0]> = {}) {
    return {
        doi: "10.3389/fbioe.2023.1143157",
        findPmcidBySearch: vi.fn(async () => null),
        findPmcidByDoi: vi.fn(async () => null),
        loadPmc: vi.fn(async () => paper("nih", ["Abstract", "1 Introduction"])),
        springerHasDoi: vi.fn(async () => false),
        loadSpringer: vi.fn(async () => paper("springer", ["Abstract", "Methods"])),
        ...overrides,
    };
}

describe("homeScholarResult", () => {
    it("reads a Scholar result from PubMed Central when NCBI search finds it", async () => {
        const input = deps({ findPmcidBySearch: vi.fn(async () => "10034092") });
        const home = await homeScholarResult(input);
        expect(home?.source).toBe("nih");
        expect(input.findPmcidByDoi).not.toHaveBeenCalled();
        expect(input.loadSpringer).not.toHaveBeenCalled();
    });

    it("still finds PubMed Central by exact DOI when NCBI search fails", async () => {
        const input = deps({
            findPmcidBySearch: vi.fn(async () => {
                throw new Error("429 from NCBI");
            }),
            findPmcidByDoi: vi.fn(async () => "10034092"),
        });
        const home = await homeScholarResult(input);
        expect(input.findPmcidByDoi).toHaveBeenCalledWith("10.3389/fbioe.2023.1143157");
        expect(home?.source).toBe("nih");
        expect(input.loadSpringer).not.toHaveBeenCalled();
    });

    it("never files another publisher's DOI under Springer Nature", async () => {
        const input = deps({ doi: "10.1002/bies.202000047" });
        expect(await homeScholarResult(input)).toBeNull();
        expect(input.springerHasDoi).toHaveBeenCalledWith("10.1002/bies.202000047");
        expect(input.loadSpringer).not.toHaveBeenCalled();
    });

    it("uses Springer Nature for a DOI Springer has", async () => {
        const input = deps({ doi: "10.1007/x", springerHasDoi: vi.fn(async () => true) });
        const home = await homeScholarResult(input);
        expect(home?.source).toBe("springer");
        expect(home?.contentNotice).toMatch(/Springer Nature full-text record/);
    });

    it("stays a Scholar snippet when there is no DOI and no PubMed Central record", async () => {
        const input = deps({ doi: null });
        expect(await homeScholarResult(input)).toBeNull();
        expect(input.findPmcidByDoi).not.toHaveBeenCalled();
        expect(input.springerHasDoi).not.toHaveBeenCalled();
    });

    it("falls through when the PubMed Central record has no text", async () => {
        const input = deps({
            findPmcidBySearch: vi.fn(async () => "10034092"),
            loadPmc: vi.fn(async () => paper("nih", [])),
        });
        expect(await homeScholarResult(input)).toBeNull();
    });
});
