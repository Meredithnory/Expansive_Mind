import type { SourceDatabase } from "./paper-sources";
import {
    evaluateContentAccess,
    isCommercialFriendlyLicense,
    normalizeLicense,
    type NormalizedLicense,
} from "./content-access-policy";

export type QuoteBlockReason =
    | "ok"
    | "scholar_snippet"
    | "abstract_only"
    | "null_license"
    | "license_not_commercial_friendly"
    | "license_conflict";

export interface QuoteEligibility {
    allowed: boolean;
    reason: QuoteBlockReason;
    license: NormalizedLicense;
    licenseUrl: string | null;
}

type SectionLike = {
    title?: string;
    content?: string;
};

const QUOTE_ATTRIBUTION = {
    title: "Untitled",
    authors: [] as string[],
    sourceLabel: "Quote gate",
    canonicalUrl: "",
    paperId: "",
    idName: "",
};

export function isScholarSnippetSource(input: {
    source?: string | null;
    database?: string | null;
    contentLabel?: string | null;
}): boolean {
    return (
        input.source === "scholar" ||
        input.database === "scholar" ||
        input.contentLabel === "Search snippet"
    );
}

export function paperHasFullTextBody(paper: {
    paper?: SectionLike[] | null;
}): boolean {
    return (paper.paper ?? []).some((section) => {
        const title = (section.title || "").toLowerCase();
        if (title.includes("abstract")) return false;
        return Boolean(section.content?.trim());
    });
}

/** Home JATS/JSON license only. Unpaywall/OpenAlex OA records never fill a null home license. */
export function quoteLicenseFromHome(
    home: { rawLicense?: string | null; licenseUrl?: string | null },
    _oa?: { rawLicense?: string | null; licenseUrl?: string | null } | null,
): { rawLicense: string | null; licenseUrl: string | null } {
    void _oa;
    return {
        rawLicense: home.rawLicense?.trim() || null,
        licenseUrl: home.licenseUrl?.trim() || null,
    };
}

export function isCommercialFriendlyLicenseUri(
    licenseUrl: string | null | undefined,
): boolean {
    const url = licenseUrl?.trim() || "";
    if (!url) return false;
    return isCommercialFriendlyLicense(
        normalizeLicense(null, url).normalizedLicense,
    );
}

export function evaluateQuoteEligibility(input: {
    source?: string | null;
    database?: SourceDatabase | string | null;
    contentLabel?: string | null;
    hasFullTextBody: boolean;
    rawLicense?: string | null;
    licenseUrl?: string | null;
    hasConflictingLicenseData?: boolean;
}): QuoteEligibility {
    if (
        isScholarSnippetSource({
            source: input.source,
            database: input.database,
            contentLabel: input.contentLabel,
        })
    ) {
        return {
            allowed: false,
            reason: "scholar_snippet",
            license: "UNKNOWN",
            licenseUrl: null,
        };
    }

    if (!input.hasFullTextBody) {
        return {
            allowed: false,
            reason: "abstract_only",
            license: "UNKNOWN",
            licenseUrl: null,
        };
    }

    const source: SourceDatabase =
        input.source === "springer" || input.database === "springer"
            ? "springer"
            : input.source === "scholar" || input.database === "scholar"
              ? "scholar"
              : "nih";

    const access = evaluateContentAccess({
        source,
        rawLicense: input.rawLicense,
        licenseUrl: input.licenseUrl,
        attribution: QUOTE_ATTRIBUTION,
        hasConflictingLicenseData: input.hasConflictingLicenseData,
        mode: "strict",
    });

    if (access.policyReasonCode === "license_conflict") {
        return {
            allowed: false,
            reason: "license_conflict",
            license: access.normalizedLicense,
            licenseUrl: access.licenseUrl,
        };
    }

    if (!access.rawLicense && !access.licenseUrl) {
        return {
            allowed: false,
            reason: "null_license",
            license: access.normalizedLicense,
            licenseUrl: null,
        };
    }

    if (!isCommercialFriendlyLicense(access.normalizedLicense)) {
        return {
            allowed: false,
            reason: "license_not_commercial_friendly",
            license: access.normalizedLicense,
            licenseUrl: access.licenseUrl,
        };
    }

    return {
        allowed: true,
        reason: "ok",
        license: access.normalizedLicense,
        licenseUrl: access.licenseUrl,
    };
}
