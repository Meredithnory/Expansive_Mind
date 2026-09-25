import { describe, expect, it } from "vitest";
import {
    chartPolyline,
    featureLabel,
    fillDailySeries,
    formatUsd,
    percentChange,
    shareOf,
    successRate,
} from "./admin-overview";

describe("fillDailySeries", () => {
    it("fills missing UTC days with zeros", () => {
        const filled = fillDailySeries(
            [
                {
                    date: "2026-09-12",
                    calls: 8,
                    costUsd: 0.04,
                    failures: 1,
                    features: { discover: { calls: 8, costUsd: 0.04 } },
                },
            ],
            3,
            new Date("2026-09-13T12:00:00.000Z"),
        );
        expect(filled.map((row) => row.date)).toEqual([
            "2026-09-11",
            "2026-09-12",
            "2026-09-13",
        ]);
        expect(filled[0]).toMatchObject({ calls: 0, costUsd: 0 });
        expect(filled[1].calls).toBe(8);
    });
});

describe("unit economics helpers", () => {
    it("computes rates and currency for ops review", () => {
        expect(successRate(100, 2)).toBeCloseTo(0.98);
        expect(shareOf(0.12, 0.16)).toBeCloseTo(0.75);
        expect(percentChange(0.16, 0.08)).toBeCloseTo(100);
        expect(percentChange(4, 0)).toBeNull();
        expect(formatUsd(0.1277)).toBe("$0.128");
        expect(featureLabel("scholar_search")).toBe("Scholar search");
    });

    it("draws a polyline from daily values", () => {
        expect(chartPolyline([0, 2, 1], 100, 20, 0)).toContain("M");
        expect(chartPolyline([], 100, 20)).toBe("");
    });
});
