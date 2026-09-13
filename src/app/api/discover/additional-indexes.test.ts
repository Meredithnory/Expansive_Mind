import { afterEach, describe, expect, it, vi } from "vitest";
import { mapEuropePmcRecord, normalizeDiscoveryDoi, searchCrossref, searchEuropePmc } from "./additional-indexes";
import { dedupeDiscoverCandidates } from "./select-candidates";

const paper = { source: "MED", pmcid: "PMC12345", doi: "10.1234/example", title: "Example paper", abstractText: "Abstract", license: "CC BY 4.0", firstPublicationDate: "2025-06-01", authorList: { author: [{ fullName: "A. Author" }] }, pubTypeList: { pubType: ["Journal Article"] } };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("additional research indexes", () => {
    it("maps index provenance separately from the content host and respects strict licensing", () => {
        vi.stubEnv("CONTENT_ACCESS_MODE", "strict");
        const candidate = mapEuropePmcRecord(paper)!;
        expect(candidate).toMatchObject({ database: "nih", paperId: "12345", doi: "10.1234/example", indexedBy: ["Europe PMC"], access: { canSendToAI: true } });
        expect(mapEuropePmcRecord({ ...paper, license: "CC BY-NC 4.0" })?.access.canSendToAI).toBe(false);
        expect(mapEuropePmcRecord({ ...paper, license: null })?.access.canSendToAI).toBe(false);
    });
    it("excludes preprints, known retractions, non-PMC records, and invalid IDs", () => {
        for (const change of [{ source: "PPR" }, { pmcid: "https://evil.test" }, { isRetracted: "Y" }, { pubTypeList: { pubType: ["Retracted Publication"] } }, { pubTypeList: { pubType: ["Preprint"] } }]) expect(mapEuropePmcRecord({ ...paper, ...change })).toBeNull();
    });
    it("bounds Europe PMC searches and reports partial failures without dropping successful results", async () => {
        const fetch = vi.fn().mockResolvedValueOnce(Response.json({ resultList: { result: [paper] } })).mockRejectedValueOnce(new Error("unavailable"));
        vi.stubGlobal("fetch", fetch);
        const result = await searchEuropePmc(["assay", "therapy", "ignored"]);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(result.coverage).toMatchObject({ status: "partial", metadataCount: 1, candidateCount: 1 });
        expect(result.candidates[0].paperId).toBe("12345");
    });
    it("only admits exact Crossref DOI matches resolved to readable PMC candidates", async () => {
        const fetch = vi.fn().mockResolvedValueOnce(Response.json({ message: { items: [{ DOI: "https://doi.org/10.1234/example" }] } }))
            .mockResolvedValueOnce(Response.json({ resultList: { result: [paper, { ...paper, doi: "10.9999/unrelated", pmcid: "PMC777" }, { ...paper, pmcid: null }] } }));
        vi.stubGlobal("fetch", fetch);
        const result = await searchCrossref("assay");
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].indexedBy).toEqual(["Crossref", "Europe PMC"]);
        expect(new URL(fetch.mock.calls[1][0]).searchParams.get("query")).toBe('(DOI:"10.1234/example") AND IN_PMC:Y');
    });
    it("does not use Crossref metadata itself as evidence when resolution fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ message: { items: [{ DOI: "10.1234/example" }] } })).mockRejectedValueOnce(new Error("timeout")));
        const result = await searchCrossref("assay");
        expect(result.candidates).toEqual([]);
        expect(result.coverage.status).toBe("partial");
        expect(normalizeDiscoveryDoi('10.1234/x" OR title:*')).toBeUndefined();
    });
    it("merges DOI and PMC identities transitively and retains discovery provenance", () => {
        const nih = { ...mapEuropePmcRecord(paper)!, doi: undefined, indexedBy: ["NIH PMC"] };
        const springer = { ...mapEuropePmcRecord(paper)!, database: "springer" as const, paperId: "10.1234/example", indexedBy: ["Springer Nature"] };
        const europe = mapEuropePmcRecord(paper)!;
        const crossref = mapEuropePmcRecord(paper, ["Crossref", "Europe PMC"])!;
        const result = dedupeDiscoverCandidates([nih, springer, europe, crossref, nih]);
        expect(result).toHaveLength(1);
        expect(result[0].indexedBy).toEqual(["NIH PMC", "Springer Nature", "Europe PMC", "Crossref"]);
        expect(nih.doi).toBeUndefined();
    });
});
