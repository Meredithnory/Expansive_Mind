import { afterEach, describe, expect, it, vi } from "vitest";
const { completion } = vi.hoisted(() => ({ completion: vi.fn() }));
vi.mock("../openrouter", () => ({ createPrivateChatCompletion: completion }));
vi.mock("../../lib/usage-meter", () => ({ deferUsageRecording: vi.fn() }));
import { buildFounderReport, isFounderPrimaryUrl, retrieveFounderSources } from "./founder-diligence";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("founder retrieval safety and failure handling", () => {
    it("only fetches allowed primary hosts, rejecting lookalikes and credentials", () => {
        expect(isFounderPrimaryUrl("https://www.fda.gov/example")).toBe(true);
        for (const url of ["https://fda.gov.evil.test/a", "http://www.fda.gov/a", "https://127.0.0.1/a", "https://evil@www.fda.gov/a", "https://www.fda.gov:8443/a"]) expect(isFounderPrimaryUrl(url)).toBe(false);
    });
    it("reports missing commercial search configuration without making requests", async () => {
        vi.stubEnv("SERPAPI_KEY", "");
        const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
        const result = await retrieveFounderSources("assay", "US");
        expect(result.sources).toEqual([]);
        expect(result.limitations[0]).toContain("not configured");
        expect(fetch).not.toHaveBeenCalled();
    });
    it("does not use search snippets or follow redirects off the allowed hosts", async () => {
        vi.stubEnv("SERPAPI_KEY", "test");
        const fetch = vi.fn(async (raw: string) => raw.startsWith("https://serpapi.com/")
            ? Response.json({ organic_results: [{ title: "Source", link: "https://www.fda.gov/example", snippet: "A fabricated billion dollar market" }] })
            : new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
        vi.stubGlobal("fetch", fetch);
        const result = await retrieveFounderSources("assay", "US");
        expect(result.sources).toEqual([]);
        expect(fetch.mock.calls.every(([url]) => !url.includes("127.0.0.1"))).toBe(true);
    });
    it("does not let generated JSON replace the trusted source register", async () => {
        const source = { id: "Source 1", title: "Source", url: "https://www.fda.gov/example", retrievedAt: "2026-09-07", text: "The application remains under review by the agency." };
        completion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ version: 1, status: "invest", sources: [{ ...source, text: "The agency approved this product." }], areas: [{ id: "regulatory", findings: [{ claim: "Approved", sourceId: source.id, quote: "The agency approved this product." }] }] }) } }] });
        const report = await buildFounderReport({ question: "assay", scope: "US", commercial: { sources: [source], limitations: [] }, extractions: [], papers: [] });
        expect(report.sources[0].text).toBe(source.text);
        expect(report.areas.find(area => area.id === "regulatory")?.findings).toHaveLength(0);
        expect(report.status).toBe("needs-validation");
    });
    it("returns explicit unknowns when synthesis fails", async () => {
        completion.mockRejectedValue(new Error("timeout"));
        const report = await buildFounderReport({ question: "assay", scope: "US", commercial: { sources: [{ id: "Source 1", title: "source", url: "https://www.fda.gov/example", text: "Retrieved source text for the assessment.", retrievedAt: "2026-09-07" }], limitations: [] }, extractions: [], papers: [] });
        expect(report.areas.every(area => !area.findings.length)).toBe(true);
        expect(report.limitations.join(" ")).toContain("synthesis failed");
    });
});
