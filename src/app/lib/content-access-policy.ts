import type { SourceDatabase } from "./paper-sources";

export type NormalizedLicense =
    | "CC0"
    | "CC-BY"
    | "CC-BY-SA"
    | "CC-BY-ND"
    | "OTHER"
    | "UNKNOWN";
export type ContentAccessMode = "strict" | "legacy";

export type PolicyReasonCode =
    | "allowed_cc0"
    | "allowed_cc_by"
    | "allowed_cc_by_sa"
    | "allowed_cc_by_nd"
    | "legacy_live_access"
    | "license_not_permitted"
    | "license_unknown"
    | "license_conflict"
    | "source_no_license";

export const COMMERCIAL_FRIENDLY_LICENSES = [
    "CC0",
    "CC-BY",
    "CC-BY-SA",
    "CC-BY-ND",
] as const satisfies readonly NormalizedLicense[];

export function isCommercialFriendlyLicense(
    license: NormalizedLicense,
): boolean {
    return (
        license === "CC0" ||
        license === "CC-BY" ||
        license === "CC-BY-SA" ||
        license === "CC-BY-ND"
    );
}

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
    // itself be commercial-friendly, even when the article allows images.
    if (!input.hasSeparateRights) return Boolean(input.articleAllowsImages);
    const normalized = normalizeLicense(input.rawLicense, input.licenseUrl);
    return isCommercialFriendlyLicense(normalized.normalizedLicense);
}

export function getContentAccessMode(): ContentAccessMode {
    return process.env.CONTENT_ACCESS_MODE === "strict"
        ? "strict"
        : "legacy";
}

const CC_BY_URL =
    /^https?:\/\/creativecommons\.org\/licenses\/by\/([0-9.]+)\/?$/i;
const CC_BY_SA_URL =
    /^https?:\/\/creativecommons\.org\/licenses\/by-sa\/([0-9.]+)\/?$/i;
const CC_BY_ND_URL =
    /^https?:\/\/creativecommons\.org\/licenses\/by-nd\/([0-9.]+)\/?$/i;
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

        const ccBySaMatch = candidate.match(CC_BY_SA_URL);
        if (ccBySaMatch) {
            return {
                normalizedLicense: "CC-BY-SA",
                licenseName: `CC BY-SA ${ccBySaMatch[1]}`,
                licenseUrl: `https://creativecommons.org/licenses/by-sa/${ccBySaMatch[1]}/`,
            };
        }

        const ccByNdMatch = candidate.match(CC_BY_ND_URL);
        if (ccByNdMatch) {
            return {
                normalizedLicense: "CC-BY-ND",
                licenseName: `CC BY-ND ${ccByNdMatch[1]}`,
                licenseUrl: `https://creativecommons.org/licenses/by-nd/${ccByNdMatch[1]}/`,
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
    const nonCommercial =
        /\bNC\b/.test(text) || /NONCOMMERCIAL|NON COMMERCIAL/.test(text);

    if (!nonCommercial) {
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

        const ccBySaMatch = text.match(
            /^(?:CC BY SA|CREATIVE COMMONS ATTRIBUTION SHARE ?ALIKE)(?: ([0-9.]+))?(?: INTERNATIONAL)?$/,
        );
        if (ccBySaMatch) {
            const version = ccBySaMatch[1] || "4.0";
            return {
                normalizedLicense: "CC-BY-SA",
                licenseName: `CC BY-SA ${version}`,
                licenseUrl: `https://creativecommons.org/licenses/by-sa/${version}/`,
            };
        }

        const ccByNdMatch = text.match(
            /^(?:CC BY ND|CREATIVE COMMONS ATTRIBUTION NO DERIVATIVES)(?: ([0-9.]+))?(?: INTERNATIONAL)?$/,
        );
        if (ccByNdMatch) {
            const version = ccByNdMatch[1] || "4.0";
            return {
                normalizedLicense: "CC-BY-ND",
                licenseName: `CC BY-ND ${version}`,
                licenseUrl: `https://creativecommons.org/licenses/by-nd/${version}/`,
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
        !conflict && isCommercialFriendlyLicense(normalized.normalizedLicense);
    const mode = input.mode || getContentAccessMode();
    const allowed = mode === "legacy" || strictlyAllowed;

    let policyReasonCode: PolicyReasonCode;
    let policyReason: string;

    if (mode === "legacy" && !strictlyAllowed) {
        policyReasonCode = "legacy_live_access";
        policyReason =
            "Live access mode is enabled. The app can display and process this source without a verified commercial-friendly license, but publisher permission may still be required.";
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
    } else if (normalized.normalizedLicense === "CC-BY-SA") {
        policyReasonCode = "allowed_cc_by_sa";
        policyReason =
            "This article is licensed under CC BY-SA and may be displayed and processed with attribution and share-alike.";
    } else if (normalized.normalizedLicense === "CC-BY-ND") {
        policyReasonCode = "allowed_cc_by_nd";
        policyReason =
            "This article is licensed under CC BY-ND and may be displayed and processed with attribution and no derivatives.";
    } else if (input.source === "scholar") {
        policyReasonCode = "source_no_license";
        policyReason =
            "Google Scholar supplies discovery metadata, not reusable article rights. Open the publisher link to read the paper.";
    } else if (normalized.normalizedLicense === "UNKNOWN") {
        policyReasonCode = "license_unknown";
        policyReason =
            "No qualifying commercial-friendly license could be verified, so only citation and metadata can be shown.";
    } else {
        policyReasonCode = "license_not_permitted";
        policyReason = `${normalized.licenseName || "This license"} is outside this app's commercial-friendly full-text policy, so only citation and metadata can be shown.`;
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
