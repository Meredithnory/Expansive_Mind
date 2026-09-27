import { describe, expect, it } from "vitest";
import {
    buildRegistryQuery,
    fiscalYearRangeLabel,
    formatTrialPhase,
    nihFiscalYear,
    parseGapActivity,
    parseGapRegistryFields,
    recentFiscalYears,
    sanitizeRegistryTerms,
} from "./gap-activity";

const stored = {
    checkedAt: "2026-09-26T12:00:00.000Z",
    query: '("senolytics" AND "alzheimer")',
    fiscalYears: [2024, 2025, 2026],
    grants: {
        status: "ok",
        total: 75,
        items: [
            {
                coreProjectNum: "R56AG102998",
                title: "Cellular Senescence in Alzheimer's Disease",
                fiscalYear: 2026,
                href: "https://reporter.nih.gov/project-details/11605840",
            },
        ],
    },
    trials: {
        status: "ok",
        total: 2,
        items: [
            {
                nctId: "NCT04685590",
                title: "SToMP-AD",
                status: "ACTIVE_NOT_RECRUITING",
                phase: "Phase 2",
                href: "https://evil.test/NCT04685590",
            },
        ],
    },
};

describe("gap activity helpers", () => {
    it("sanitizes model search terms into bounded AND-groups", () => {
        expect(
            sanitizeRegistryTerms([
                ["Senolytics", 'alzheimer") OR ("x'],
                ["senescent cells", "alzheimer", "microglia", "extra"],
                ["alzheimer", "senolytics"],
                ["AND", "alzheimer"],
                [["nested"]],
                ["dasatinib", "quercetin"],
            ]),
        ).toEqual([
            ["senolytics", "alzheimer or x"],
            ["senescent cells", "alzheimer", "microglia"],
            ["alzheimer", "senolytics"],
        ]);
        expect(
            sanitizeRegistryTerms([["senolytics", "alzheimer"], ["Alzheimer", "senolytics"]]),
        ).toEqual([["senolytics", "alzheimer"]]);
        expect(sanitizeRegistryTerms("senolytics")).toEqual([]);
        expect(sanitizeRegistryTerms([["x".repeat(41), "alzheimer"]])).toEqual([]);
        expect(sanitizeRegistryTerms([["crispr base editing therapy", "sickle cell"]])).toEqual([]);
    });

    it("drops generic concepts and groups that fall below two concepts", () => {
        // Terms the model actually produced in a live run that matched thousands of records.
        expect(
            sanitizeRegistryTerms([
                ["senescence", "biomarkers"],
                ["long term", "alzheimer"],
                ["cell type", "alzheimer"],
                ["senolytic", "safety"],
                ["microglia", "senescence"],
            ]),
        ).toEqual([["microglia", "senescence"]]);
    });

    it("builds one quoted boolean query for both registries", () => {
        expect(
            buildRegistryQuery([
                ["senolytics", "alzheimer"],
                ["senescent cells", "alzheimer"],
            ]),
        ).toBe('("senolytics" AND "alzheimer") OR ("senescent cells" AND "alzheimer")');
    });

    it("uses the NIH fiscal year, which starts October 1", () => {
        expect(nihFiscalYear(new Date("2026-09-30T23:00:00Z"))).toBe(2026);
        expect(nihFiscalYear(new Date("2026-10-01T00:00:00Z"))).toBe(2027);
        expect(recentFiscalYears(new Date("2026-09-26T00:00:00Z"))).toEqual([2024, 2025, 2026]);
        expect(fiscalYearRangeLabel([2024, 2025, 2026])).toBe("FY2024–26");
        expect(fiscalYearRangeLabel([])).toBe("");
    });

    it("formats trial phases and drops NA", () => {
        expect(formatTrialPhase(["PHASE1", "PHASE2"])).toBe("Phase 1/2");
        expect(formatTrialPhase(["EARLY_PHASE1"])).toBe("Phase early 1");
        expect(formatTrialPhase(["NA"])).toBeUndefined();
        expect(formatTrialPhase(undefined)).toBeUndefined();
    });

    it("re-validates stored activity and rebuilds trial links", () => {
        const activity = parseGapActivity(stored)!;
        expect(activity.grants.items).toHaveLength(1);
        expect(activity.trials.items[0].href).toBe("https://clinicaltrials.gov/study/NCT04685590");
    });

    it("drops grants whose link is not a RePORTER project page", () => {
        const activity = parseGapActivity({
            ...stored,
            grants: {
                status: "ok",
                total: 1,
                items: [{ ...stored.grants.items[0], href: "javascript:alert(1)" }],
            },
        })!;
        expect(activity.grants.items).toEqual([]);
    });

    it("never shows items or counts for an unavailable registry", () => {
        const activity = parseGapActivity({
            ...stored,
            trials: { ...stored.trials, status: "unavailable" },
        })!;
        expect(activity.trials).toEqual({ status: "unavailable", total: 0, items: [] });
    });

    it("rejects malformed activity and omits empty optional fields", () => {
        expect(parseGapActivity({ ...stored, checkedAt: "not a date" })).toBeUndefined();
        expect(parseGapActivity(null)).toBeUndefined();
        expect(parseGapRegistryFields({ title: "Gap" })).toEqual({});
    });
});
