import { describe, expect, it } from "vitest";
import type { ContentAccessPolicy } from "../../lib/content-access-policy";
import { oaConflictsWithHome } from "./oa";

const home = (
    overrides: Partial<ContentAccessPolicy> = {},
): ContentAccessPolicy => ({
    rawLicense: "CC BY 4.0",
    normalizedLicense: "CC-BY",
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    canonicalUrl: "https://example.com",
    attribution: {
        title: "Example",
        authors: ["A"],
        sourceLabel: "NIH PubMed Central",
        canonicalUrl: "https://example.com",
        paperId: "1",
        idName: "pmcid",
    },
    policyReason: "allowed",
    policyReasonCode: "allowed_cc_by",
    canDisplayFullText: true,
    canSendToAI: true,
    canPersistContent: true,
    canUseImages: true,
    ...overrides,
});

describe("oaConflictsWithHome", () => {
    it("flags a CC-BY home against an NC Unpaywall license", () => {
        expect(
            oaConflictsWithHome(
                { doi: "10.1000/x", rawLicense: "cc-by-nc" },
                home(),
            ),
        ).toBe(true);
    });

    it("does not widen UNKNOWN home from a CC-BY Unpaywall record", () => {
        expect(
            oaConflictsWithHome(
                { doi: "10.1000/x", rawLicense: "cc-by" },
                home({ normalizedLicense: "UNKNOWN" }),
            ),
        ).toBe(false);
    });
});
