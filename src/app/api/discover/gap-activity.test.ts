import { afterEach, describe, expect, it, vi } from "vitest";
import { attachGapActivity, searchActiveTrials, searchNihGrants } from "./gap-activity";
import type { OpportunityReport, ReportGap } from "./report-types";

const reporterResponse = {
    meta: { total: 76 },
    results: [
        { appl_id: 11605840, core_project_num: "R56AG102998", project_title: "Cellular Senescence in Alzheimer's Disease", fiscal_year: 2026 },
        { appl_id: 11400000, core_project_num: "R56AG102998", project_title: "Cellular Senescence in Alzheimer's Disease", fiscal_year: 2025 },
        { appl_id: 11540697, core_project_num: "R21AG087907", project_title: "Senescent cells in the microenvironment", fiscal_year: 2026 },
        { appl_id: "bad", core_project_num: "R01X", project_title: "Bad id", fiscal_year: 2026 },
    ],
};

const trialsResponse = {
    totalCount: 2,
    studies: [
        {
            protocolSection: {
                identificationModule: { nctId: "NCT04685590", briefTitle: "SToMP-AD" },
                statusModule: { overallStatus: "ACTIVE_NOT_RECRUITING" },
                designModule: { phases: ["PHASE2"] },
            },
        },
        { protocolSection: { identificationModule: { nctId: "bogus", briefTitle: "x" } } },
    ],
};

const gap = (overrides: Partial<ReportGap> = {}): ReportGap => ({
    title: "Senolytics in AD",
    description: "No human trials",
    whyItMatters: "",
    citations: [1],
    confidence: "suggested",
    ...overrides,
});

const report = (gaps: ReportGap[]): OpportunityReport => ({
    sections: { stateOfScience: "x", gaps, problems: [], venturePotential: [], couldNotVerify: [], projectSeeds: [] },
});

function stubRegistries() {
    const fetch = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(async (url) =>
        String(url).startsWith("https://api.reporter.nih.gov")
            ? Response.json(reporterResponse)
            : Response.json(trialsResponse),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("gap activity lookups", () => {
    it("dedupes RePORTER project-years and keeps only valid rows", async () => {
        const fetch = stubRegistries();
        const result = await searchNihGrants('("senolytics" AND "alzheimer")', [2024, 2025, 2026]);
        expect(result.status).toBe("ok");
        expect(result.total).toBe(76);
        expect(result.items.map((item) => item.coreProjectNum)).toEqual(["R56AG102998", "R21AG087907"]);
        expect(result.items[0].href).toBe("https://reporter.nih.gov/project-details/11605840");
        const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
        expect(body.criteria.advanced_text_search).toMatchObject({ operator: "advanced", search_text: '("senolytics" AND "alzheimer")' });
        expect(body.criteria.fiscal_years).toEqual([2024, 2025, 2026]);
        expect(body.include_fields).not.toContain("ContactPiName");
    });

    it("maps active trials and filters by active statuses", async () => {
        const fetch = stubRegistries();
        const result = await searchActiveTrials('("senolytics" AND "alzheimer")');
        expect(result).toEqual({
            status: "ok",
            total: 2,
            items: [{ nctId: "NCT04685590", title: "SToMP-AD", status: "ACTIVE_NOT_RECRUITING", phase: "Phase 2", href: "https://clinicaltrials.gov/study/NCT04685590" }],
        });
        const params = new URL(String(fetch.mock.calls[0][0])).searchParams;
        expect(params.get("filter.overallStatus")).toBe("RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION");
    });

    it("reports a registry as unavailable instead of throwing", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
        await expect(searchNihGrants("q", [2026])).resolves.toEqual({ status: "unavailable", total: 0, items: [] });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
        await expect(searchActiveTrials("q")).resolves.toEqual({ status: "unavailable", total: 0, items: [] });
    });

    it("attaches activity only to gaps with search terms and spaces RePORTER calls", async () => {
        const fetch = stubRegistries();
        const wait = vi.fn().mockResolvedValue(undefined);
        const result = await attachGapActivity(
            report([
                gap({ registryTerms: [["senolytics", "alzheimer"]] }),
                gap({ title: "No terms" }),
                gap({ registryTerms: [["senescent cells", "alzheimer"]] }),
            ]),
            { now: new Date("2026-09-26T12:00:00Z"), wait },
        );
        const [first, second, third] = result.sections.gaps;
        expect(first.activity).toMatchObject({
            checkedAt: "2026-09-26T12:00:00.000Z",
            query: '("senolytics" AND "alzheimer")',
            fiscalYears: [2024, 2025, 2026],
            grants: { status: "ok", total: 76 },
            trials: { status: "ok", total: 2 },
        });
        expect(second.activity).toBeUndefined();
        expect(third.activity?.query).toBe('("senescent cells" AND "alzheimer")');
        expect(wait).toHaveBeenCalledTimes(1);
        expect(wait).toHaveBeenCalledWith(1_100);
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("strips activity the model tried to supply", async () => {
        const fetch = stubRegistries();
        const injected = { checkedAt: "2026-01-01T00:00:00Z", query: "x", fiscalYears: [], grants: { status: "ok" as const, total: 0, items: [] }, trials: { status: "ok" as const, total: 0, items: [] } };
        const result = await attachGapActivity(report([gap({ activity: injected })]));
        expect(result.sections.gaps[0].activity).toBeUndefined();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("stops starting RePORTER lookups once the time budget is spent", async () => {
        let now = 0;
        const clock = () => now;
        const wait = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
            if (!String(url).startsWith("https://api.reporter.nih.gov")) return Response.json(trialsResponse);
            now += 20_000;
            return Response.json(reporterResponse);
        }));
        const result = await attachGapActivity(
            report([
                gap({ registryTerms: [["a1", "b1"]] }),
                gap({ registryTerms: [["a2", "b2"]] }),
            ]),
            { wait, clock },
        );
        expect(result.sections.gaps[0].activity).toBeDefined();
        expect(result.sections.gaps[1].activity).toBeUndefined();
    });
});
