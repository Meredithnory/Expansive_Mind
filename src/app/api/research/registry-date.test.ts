import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const springerSearch = vi.hoisted(() => vi.fn());
vi.mock("../search/utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../search/utils")>()),
    searchSpringerNaturePapers: springerSearch,
}));

import { searchHomed } from "./registry";

describe("searchHomed", () => {
    const key = process.env.SPRINGER_API_KEY;

    afterEach(() => {
        if (key === undefined) delete process.env.SPRINGER_API_KEY;
        else process.env.SPRINGER_API_KEY = key;
    });

    it("hands the publication range to the source's own search", async () => {
        process.env.SPRINGER_API_KEY = "test-key";
        springerSearch.mockResolvedValue({ results: [], totalCount: 0, totalPages: 0 });
        const dateRange = { fromYear: 2025, toYear: 2026 };

        await searchHomed({
            query: "kinase",
            page: 0,
            databases: ["springer"],
            hydrate: false,
            dateRange,
        });

        expect(springerSearch).toHaveBeenCalledWith("kinase", 0, dateRange);
    });
});
