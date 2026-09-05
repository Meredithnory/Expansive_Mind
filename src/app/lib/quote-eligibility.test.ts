import { describe, expect, it } from "vitest";
import {
    evaluateQuoteEligibility,
    isCommercialFriendlyLicenseUri,
    isScholarSnippetSource,
    paperHasFullTextBody,
} from "./quote-eligibility";

describe("isScholarSnippetSource", () => {
    it("treats Scholar homes and SerpApi snippets as non-quotable", () => {
        expect(isScholarSnippetSource({ source: "scholar" })).toBe(true);
        expect(isScholarSnippetSource({ database: "scholar" })).toBe(true);
        expect(
            isScholarSnippetSource({ contentLabel: "Search snippet" }),
        ).toBe(true);
        expect(
            isScholarSnippetSource({
                source: "nih",
                contentLabel: "Abstract",
            }),
        ).toBe(false);
    });
});

describe("paperHasFullTextBody", () => {
    it("requires a non-abstract section with text", () => {
        expect(
            paperHasFullTextBody({
                paper: [
                    { title: "Abstract", content: "A trial summary." },
                ],
            }),
        ).toBe(false);
        expect(
            paperHasFullTextBody({
                paper: [
                    { title: "Abstract", content: "A trial summary." },
                    { title: "Results", content: "Events fell by 12%." },
                ],
            }),
        ).toBe(true);
        expect(paperHasFullTextBody({ paper: [] })).toBe(false);
    });
});

describe("evaluateQuoteEligibility", () => {
    it("allows OA full text under commercial-friendly licenses, including SA and ND", () => {
        for (const raw of ["CC BY 4.0", "CC BY-SA 4.0", "CC BY-ND 4.0", "CC0"]) {
            const result = evaluateQuoteEligibility({
                source: "nih",
                hasFullTextBody: true,
                rawLicense: raw,
            });
            expect(result).toMatchObject({ allowed: true, reason: "ok" });
            expect(result.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
        }
    });

    it("blocks Scholar snippets, abstracts, null licenses, and NC", () => {
        expect(
            evaluateQuoteEligibility({
                source: "scholar",
                contentLabel: "Search snippet",
                hasFullTextBody: false,
                rawLicense: null,
            }).reason,
        ).toBe("scholar_snippet");
        expect(
            evaluateQuoteEligibility({
                source: "nih",
                hasFullTextBody: false,
                rawLicense: "CC BY 4.0",
            }).reason,
        ).toBe("abstract_only");
        expect(
            evaluateQuoteEligibility({
                source: "nih",
                hasFullTextBody: true,
                rawLicense: null,
            }).reason,
        ).toBe("null_license");
        expect(
            evaluateQuoteEligibility({
                source: "nih",
                hasFullTextBody: true,
                rawLicense: "CC BY-NC 4.0",
            }).reason,
        ).toBe("license_not_commercial_friendly");
    });

    it("evaluates quotes in strict mode even when the process default is legacy", () => {
        const previous = process.env.CONTENT_ACCESS_MODE;
        process.env.CONTENT_ACCESS_MODE = "legacy";
        try {
            expect(
                evaluateQuoteEligibility({
                    source: "nih",
                    hasFullTextBody: true,
                    rawLicense: null,
                }).allowed,
            ).toBe(false);
        } finally {
            if (previous === undefined) delete process.env.CONTENT_ACCESS_MODE;
            else process.env.CONTENT_ACCESS_MODE = previous;
        }
    });
});

describe("isCommercialFriendlyLicenseUri", () => {
    it("accepts canonical commercial-friendly URIs and rejects NC or empty", () => {
        expect(
            isCommercialFriendlyLicenseUri(
                "https://creativecommons.org/licenses/by-sa/4.0/",
            ),
        ).toBe(true);
        expect(
            isCommercialFriendlyLicenseUri(
                "https://creativecommons.org/licenses/by-nc/4.0/",
            ),
        ).toBe(false);
        expect(isCommercialFriendlyLicenseUri(null)).toBe(false);
    });
});
