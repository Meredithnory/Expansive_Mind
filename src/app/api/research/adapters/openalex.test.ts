import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseOpenAlexWork } from "./openalex";

describe("parseOpenAlexWork", () => {
    it("reads DOI, PMCID, and an inverted abstract without treating oa_status as a license", () => {
        const lead = parseOpenAlexWork({
            display_name: "A PMC work",
            publication_year: 2024,
            ids: {
                doi: "https://doi.org/10.1000/oa-work",
                pmcid: "PMC7654321",
            },
            authorships: [
                { author: { display_name: "Ada Lovelace" } },
            ],
            open_access: { is_oa: true, oa_status: "gold" },
            primary_location: { license: "cc-by" },
            abstract_inverted_index: { Events: [0], fell: [1] },
        });
        expect(lead).toMatchObject({
            producer: "openalex",
            pmcid: "7654321",
            licenseHint: "cc-by",
            citation: {
                title: "A PMC work",
                doi: "10.1000/oa-work",
                authors: ["Ada Lovelace"],
            },
            abstract: "Events fell",
        });
    });
});
