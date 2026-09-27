import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GapActivityView from "./GapActivityView";
import type { GapActivity } from "../api/discover/report-types";

const activity = (grantsTotal: number, trialsTotal: number): GapActivity => ({
    checkedAt: "2026-09-26T12:00:00.000Z",
    query: '("senolytics" AND "alzheimer")',
    fiscalYears: [2024, 2025, 2026],
    grants: {
        status: "ok",
        total: grantsTotal,
        items: [{ coreProjectNum: "R56AG102998", title: "Cellular Senescence in AD", fiscalYear: 2026, href: "https://reporter.nih.gov/project-details/11605840" }],
    },
    trials: {
        status: "ok",
        total: trialsTotal,
        items: [{ nctId: "NCT04685590", title: "SToMP-AD", status: "ACTIVE_NOT_RECRUITING", phase: "Phase 2", href: "https://clinicaltrials.gov/study/NCT04685590" }],
    },
});

describe("GapActivityView", () => {
    it("lists related grants and trials with the absence caveat", () => {
        const html = renderToStaticMarkup(<GapActivityView activity={activity(76, 2)} />);
        expect(html).toContain("NIH grants (FY2024–26)");
        expect(html).toContain("76 matching project records");
        expect(html).toContain("Cellular Senescence in AD");
        expect(html).toContain("Phase 2 · Active, not recruiting");
        expect(html).toContain("no match does not mean no one is working on this");
        expect(html).not.toMatch(/unfunded/i);
    });

    it("hides example rows when the match is too broad to mean anything", () => {
        const html = renderToStaticMarkup(<GapActivityView activity={activity(4290, 1571)} />);
        expect(html).toContain("4,290 loose matches, too broad to single out related work.");
        expect(html).toContain("1,571 loose matches");
        expect(html).not.toContain("Cellular Senescence in AD");
        expect(html).not.toContain("Search ClinicalTrials.gov");
    });

    it("can leave the caveat to a parent that shows it once", () => {
        const html = renderToStaticMarkup(<GapActivityView activity={activity(76, 2)} showCaveat={false} />);
        expect(html).not.toContain("no match does not mean");
    });

    it("says when a registry could not be reached", () => {
        const html = renderToStaticMarkup(
            <GapActivityView activity={{ ...activity(0, 0), grants: { status: "unavailable", total: 0, items: [] } }} />,
        );
        expect(html).toContain("NIH RePORTER could not be reached.");
        expect(html).toContain("No matching active trials found.");
    });
});
