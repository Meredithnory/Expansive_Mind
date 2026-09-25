import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseEuropePmcRecord } from "./europepmc";

describe("parseEuropePmcRecord", () => {
    it("keeps isOpenAccess from becoming a license", () => {
        const lead = parseEuropePmcRecord({
            title: "A PMC work",
            pmcid: "PMC111",
            doi: "10.1000/epmc",
            isOpenAccess: "Y",
            abstractText: "Events fell.",
            authorList: {
                author: [{ fullName: "Ada Lovelace" }],
            },
        });
        expect(lead).toMatchObject({
            producer: "europepmc",
            pmcid: "111",
            licenseHint: null,
            licenseUrl: null,
            citation: { doi: "10.1000/epmc", authors: ["Ada Lovelace"] },
            abstract: "Events fell.",
        });
    });

    it("persists a canonical license URI from Europe PMC license text", () => {
        const lead = parseEuropePmcRecord({
            title: "A licensed work",
            pmcid: "PMC111",
            doi: "10.1000/epmc",
            license: "cc-by-sa",
        });
        expect(lead).toMatchObject({
            licenseHint: "cc-by-sa",
            licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        });
    });
});
