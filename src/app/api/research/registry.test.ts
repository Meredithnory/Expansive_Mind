import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
    hasConfiguredLiteratureSource,
    providerHealth,
    toSearchRow,
} from "./registry";

describe("providerHealth", () => {
    const keys = [
        "SPRINGER_API_KEY",
        "SERPAPI_KEY",
        "API_KEY",
        "NCBI_EMAIL",
        "OPENALEX_API_KEY",
        "OPENALEX_MAILTO",
        "EUROPEPMC_EMAIL",
        "UNPAYWALL_EMAIL",
    ] as const;
    const snapshot = Object.fromEntries(
        keys.map((key) => [key, process.env[key]]),
    );

    afterEach(() => {
        for (const key of keys) {
            const value = snapshot[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("skips new catalogs when their env is unset", () => {
        delete process.env.OPENALEX_API_KEY;
        delete process.env.OPENALEX_MAILTO;
        delete process.env.EUROPEPMC_EMAIL;
        delete process.env.UNPAYWALL_EMAIL;
        const health = providerHealth();
        expect(health.find((row) => row.id === "openalex")?.configured).toBe(
            false,
        );
        expect(health.find((row) => row.id === "europepmc")?.configured).toBe(
            false,
        );
        expect(health.find((row) => row.id === "unpaywall")?.configured).toBe(
            false,
        );
    });

    it("does not treat Unpaywall as enough to run Discover", () => {
        delete process.env.SPRINGER_API_KEY;
        delete process.env.SERPAPI_KEY;
        delete process.env.API_KEY;
        delete process.env.NCBI_EMAIL;
        delete process.env.OPENALEX_API_KEY;
        delete process.env.OPENALEX_MAILTO;
        delete process.env.EUROPEPMC_EMAIL;
        process.env.UNPAYWALL_EMAIL = "ops@example.com";
        expect(hasConfiguredLiteratureSource()).toBe(false);
    });
});

describe("toSearchRow", () => {
    it("keeps Springer's persisted nature search tag", () => {
        const row = toSearchRow({
            database: "springer",
            paperId: "10.1000/x",
            idName: "doi",
            title: "A paper",
            authors: ["Ada"],
            date: "2024",
            abstract: "Hello",
            sourceLabel: "Springer Nature",
            sourceUrl: "https://doi.org/10.1000/x",
            doi: "10.1000/x",
            access: {
                canSendToAI: true,
            } as never,
        });
        expect(row.source).toBe("nature");
        expect(row.sourceId).toBe("10.1000/x");
    });
});
