import type { SourceDatabase } from "./paper-sources";

export type NormalizedLicense = "CC0" | "CC-BY" | "OTHER" | "UNKNOWN";
export type ContentAccessMode = "strict" | "legacy";

export type PolicyReasonCode =
    | "allowed_cc0"
    | "allowed_cc_by"
    | "legacy_live_access"
    | "license_not_permitted"
    | "license_unknown"
    | "license_conflict"
    | "source_no_license";

export interface ArticleAttribution {
    title: string;
    authors: string[];
    sourceLabel: string;
    canonicalUrl: string;
    paperId: string;
    idName: string;
    publicationDate?: string;
    publicationName?: string;
    publisher?: string;
    doi?: string;
    copyrightStatement?: string;
}

export interface ContentAccessPolicy {
    rawLicense: string | null;
    normalizedLicense: NormalizedLicense;
    licenseName: string | null;
    licenseUrl: string | null;
    canonicalUrl: string;
    attribution: ArticleAttribution;
    policyReason: string;
    policyReasonCode: PolicyReasonCode;
    canDisplayFullText: boolean;
    canSendToAI: boolean;
    canPersistContent: boolean;
    canUseImages: boolean;
}

export interface NormalizedLicenseResult {
    normalizedLicense: NormalizedLicense;
    licenseName: string | null;
    licenseUrl: string | null;
}

export function canUseFigureImage(input: {
    rawLicense?: string | null;
    licenseUrl?: string | null;
    hasSeparateRights: boolean;
    articleAllowsImages?: boolean;
}) {
    // Figures without their own <permissions> block inherit the
    // article-level policy. A figure that declares its own license must
    // itself be CC0 or CC BY, even when the article allows images.
    if (!input.hasSeparateRights) return Boolean(input.articleAllowsImages);
    const normalized = normalizeLicense(input.rawLicense, input.licenseUrl);
    return (
        normalized.normalizedLicense === "CC0" ||
        normalized.normalizedLicense === "CC-BY"
    );
}

export function getContentAccessMode(): ContentAccessMode {
    return process.env.CONTENT_ACCESS_MODE === "strict"
        ? "strict"
        : "legacy";
}

const CC_BY_URL =
    /^https?:\/\/creativecommons\.org\/licenses\/by\/([0-9.]+)\/?$/i;
const CC0_URL =
    /^https?:\/\/creativecommons\.org\/publicdomain\/zero\/([0-9.]+)\/?$/i;

function normalizedLicenseText(rawLicense: string): string {
    return rawLicense
        .trim()
        .replace(/[©®™]/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase();
}

export function normalizeLicense(
    rawLicense: string | null | undefined,
    explicitUrl?: string | null,
): NormalizedLicenseResult {
    const raw = rawLicense?.trim() || "";
    const url = explicitUrl?.trim() || "";
    const candidates = [url, raw].filter(Boolean);

    for (const candidate of candidates) {
        const cc0Match = candidate.match(CC0_URL);
        if (cc0Match) {
            return {
                normalizedLicense: "CC0",
                licenseName: `CC0 ${cc0Match[1]}`,
                licenseUrl: `https://creativecommons.org/publicdomain/zero/${cc0Match[1]}/`,
            };
        }

        const ccByMatch = candidate.match(CC_BY_URL);
        if (ccByMatch) {
            return {
                normalizedLicense: "CC-BY",
                licenseName: `CC BY ${ccByMatch[1]}`,
                licenseUrl: `https://creativecommons.org/licenses/by/${ccByMatch[1]}/`,
            };
        }
    }

    if (!raw && !url) {
        return {
            normalizedLicense: "UNKNOWN",
            licenseName: null,
            licenseUrl: null,
        };
    }

    const text = normalizedLicenseText(raw || url);
    const restrictedVariant =
        /\b(?:NC|ND|SA)\b/.test(text) ||
        /NONCOMMERCIAL|NO DERIVATIVES|SHAREALIKE|SHARE ALIKE/.test(text);

    if (!restrictedVariant) {
        const cc0Match = text.match(
            /^(?:CREATIVE COMMONS )?(?:CC )?ZERO(?: UNIVERSAL)?(?: ([0-9.]+))?$/,
        );
        if (text === "CC0" || cc0Match) {
            const version = cc0Match?.[1] || "1.0";
            return {
                normalizedLicense: "CC0",
                licenseName: `CC0 ${version}`,
                licenseUrl: `https://creativecommons.org/publicdomain/zero/${version}/`,
            };
        }

        const ccByMatch = text.match(
            /^(?:CC BY|CREATIVE COMMONS ATTRIBUTION)(?: ([0-9.]+))?(?: INTERNATIONAL)?$/,
        );
        if (ccByMatch) {
            const version = ccByMatch[1] || "4.0";
            return {
                normalizedLicense: "CC-BY",
                licenseName: `CC BY ${version}`,
                licenseUrl: `https://creativecommons.org/licenses/by/${version}/`,
            };
        }
    }

    return {
        normalizedLicense: "OTHER",
        licenseName: raw || url,
        licenseUrl: url || null,
    };
}

export function evaluateContentAccess(input: {
    source: SourceDatabase;
    rawLicense?: string | null;
    licenseUrl?: string | null;
    attribution: ArticleAttribution;
    hasConflictingLicenseData?: boolean;
    mode?: ContentAccessMode;
}): ContentAccessPolicy {
    const normalized = normalizeLicense(input.rawLicense, input.licenseUrl);
    const conflict = Boolean(input.hasConflictingLicenseData);
    const strictlyAllowed =
        !conflict &&
        (normalized.normalizedLicense === "CC0" ||
            normalized.normalizedLicense === "CC-BY");
    const mode = input.mode || getContentAccessMode();
    const allowed = mode === "legacy" || strictlyAllowed;

    let policyReasonCode: PolicyReasonCode;
    let policyReason: string;

    if (mode === "legacy" && !strictlyAllowed) {
        policyReasonCode = "legacy_live_access";
        policyReason =
            "Live access mode is enabled. The app can display and process this source without a verified CC0 or CC BY license, but publisher permission may still be required.";
    } else if (conflict) {
        policyReasonCode = "license_conflict";
        policyReason =
            "The available license records conflict, so only citation and metadata can be shown.";
    } else if (normalized.normalizedLicense === "CC0") {
        policyReasonCode = "allowed_cc0";
        policyReason =
            "This article is explicitly released under CC0 and may be displayed and processed by the research assistant.";
    } else if (normalized.normalizedLicense === "CC-BY") {
        policyReasonCode = "allowed_cc_by";
        policyReason =
            "This article is licensed under CC BY and may be displayed and processed with attribution.";
    } else if (input.source === "scholar") {
        policyReasonCode = "source_no_license";
        policyReason =
            "Google Scholar supplies discovery metadata, not reusable article rights. Open the publisher link to read the paper.";
    } else if (normalized.normalizedLicense === "UNKNOWN") {
        policyReasonCode = "license_unknown";
        policyReason =
            "No qualifying CC0 or CC BY license could be verified, so only citation and metadata can be shown.";
    } else {
        policyReasonCode = "license_not_permitted";
        policyReason = `${normalized.licenseName || "This license"} is outside this app's CC0 and CC BY full-text policy, so only citation and metadata can be shown.`;
    }

    return {
        rawLicense: input.rawLicense?.trim() || null,
        normalizedLicense: conflict
            ? "OTHER"
            : normalized.normalizedLicense,
        licenseName: normalized.licenseName,
        licenseUrl: normalized.licenseUrl,
        canonicalUrl: input.attribution.canonicalUrl,
        attribution: input.attribution,
        policyReason,
        policyReasonCode,
        canDisplayFullText: allowed,
        canSendToAI: allowed,
        canPersistContent: allowed,
        // Figures follow the same article-level policy as full text.
        // Figures carrying their own restrictive <permissions> block are
        // still excluded per-figure by canUseFigureImage.
        canUseImages: allowed,
    };
}
