import { describe, expect, it } from "vitest";
import {
    canUseFigureImage,
    evaluateContentAccess,
    normalizeLicense,
} from "./content-access-policy";

const attribution = {
    title: "Example article",
    authors: ["A. Researcher"],
    sourceLabel: "Test source",
    canonicalUrl: "https://example.com/article",
    paperId: "123",
    idName: "id",
};

describe("normalizeLicense", () => {
    it.each([
        ["https://creativecommons.org/licenses/by/4.0/", "CC-BY"],
        ["CC BY 4.0", "CC-BY"],
        ["Creative Commons Attribution 4.0 International", "CC-BY"],
        ["https://creativecommons.org/publicdomain/zero/1.0/", "CC0"],
        ["CC0", "CC0"],
    ])("allows exact permissive license %s", (raw, expected) => {
        expect(normalizeLicense(raw).normalizedLicense).toBe(expected);
    });

    it.each([
        "CC BY-NC 4.0",
        "CC BY-ND 4.0",
        "CC BY-SA 4.0",
        "CC BY-NC-ND 4.0",
        "All rights reserved",
        "Open access",
    ])("does not allow restricted or ambiguous license %s", (raw) => {
        expect(normalizeLicense(raw).normalizedLicense).toBe("OTHER");
    });

    it("fails closed when the license is absent", () => {
        expect(normalizeLicense(null).normalizedLicense).toBe("UNKNOWN");
    });
});

describe("evaluateContentAccess", () => {
    it("allows full text and AI only for CC0 or CC BY", () => {
        const access = evaluateContentAccess({
            source: "nih",
            rawLicense: "CC BY 4.0",
            attribution,
            mode: "strict",
        });
        expect(access.canDisplayFullText).toBe(true);
        expect(access.canSendToAI).toBe(true);
        expect(access.canPersistContent).toBe(true);
        expect(access.canUseImages).toBe(true);
    });

    it("denies conflicting rights data", () => {
        const access = evaluateContentAccess({
            source: "springer",
            rawLicense: "CC BY 4.0",
            attribution,
            hasConflictingLicenseData: true,
            mode: "strict",
        });
        expect(access.canDisplayFullText).toBe(false);
        expect(access.policyReasonCode).toBe("license_conflict");
    });

    it("always restricts Scholar discovery records", () => {
        const access = evaluateContentAccess({
            source: "scholar",
            rawLicense: null,
            attribution,
            mode: "strict",
        });
        expect(access.canSendToAI).toBe(false);
        expect(access.policyReasonCode).toBe("source_no_license");
    });

    it("restores live access in legacy mode, including images", () => {
        const access = evaluateContentAccess({
            source: "nih",
            rawLicense: null,
            attribution,
            mode: "legacy",
        });
        expect(access.canDisplayFullText).toBe(true);
        expect(access.canSendToAI).toBe(true);
        expect(access.canPersistContent).toBe(true);
        expect(access.canUseImages).toBe(true);
        expect(access.policyReasonCode).toBe("legacy_live_access");
    });

    it("denies images in strict mode without a verified license", () => {
        const access = evaluateContentAccess({
            source: "nih",
            rawLicense: null,
            attribution,
            mode: "strict",
        });
        expect(access.canDisplayFullText).toBe(false);
        expect(access.canUseImages).toBe(false);
    });
});

describe("canUseFigureImage", () => {
    it("allows a figure with its own permissive license", () => {
        expect(
            canUseFigureImage({
                hasSeparateRights: true,
                rawLicense: "CC BY 4.0",
            }),
        ).toBe(true);
    });

    it("blocks a figure with its own restrictive license even when the article allows images", () => {
        expect(
            canUseFigureImage({
                hasSeparateRights: true,
                rawLicense: "All rights reserved",
                articleAllowsImages: true,
            }),
        ).toBe(false);
    });

    it("inherits the article-level policy when the figure has no separate rights", () => {
        expect(
            canUseFigureImage({
                hasSeparateRights: false,
                articleAllowsImages: true,
            }),
        ).toBe(true);
        expect(
            canUseFigureImage({
                hasSeparateRights: false,
                articleAllowsImages: false,
            }),
        ).toBe(false);
        expect(
            canUseFigureImage({
                hasSeparateRights: false,
            }),
        ).toBe(false);
    });
});
