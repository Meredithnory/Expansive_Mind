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
            citation: { doi: "10.1000/epmc", authors: ["Ada Lovelace"] },
            abstract: "Events fell.",
        });
    });
});
