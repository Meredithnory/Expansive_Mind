import { describe, expect, it } from "vitest";
import {
    dateFilterLabel,
    parseDateFilter,
    parseSourceFilter,
    publicationDateRange,
    sourceFilterLabel,
} from "./search-filters";

describe("search filters", () => {
    it("falls back to all sources and any time for unknown values", () => {
        expect(parseSourceFilter("europe-pmc")).toBe("europe-pmc");
        expect(parseSourceFilter("pubmed")).toBe("all");
        expect(parseSourceFilter(null)).toBe("all");
        expect(parseDateFilter("5-years")).toBe("5-years");
        expect(parseDateFilter("1999")).toBe("any");
        expect(parseDateFilter(undefined)).toBe("any");
    });

    it("counts the current year inside every range", () => {
        const now = new Date("2026-03-15T12:00:00Z");
        expect(publicationDateRange("any", now)).toBeUndefined();
        expect(publicationDateRange("this-year", now)).toEqual({ fromYear: 2026, toYear: 2026 });
        expect(publicationDateRange("2-years", now)).toEqual({ fromYear: 2025, toYear: 2026 });
        expect(publicationDateRange("5-years", now)).toEqual({ fromYear: 2022, toYear: 2026 });
        expect(publicationDateRange("10-years", now)).toEqual({ fromYear: 2017, toYear: 2026 });
    });

    it("names the active filters", () => {
        expect(sourceFilterLabel("nih")).toBe("NIH PubMed Central");
        expect(dateFilterLabel("2-years")).toBe("Last 2 years");
    });
});
