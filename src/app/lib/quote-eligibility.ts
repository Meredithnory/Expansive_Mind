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

/** Whole-string markers for a license the app could not determine. */
const UNDETERMINED_LICENSE_TEXT =
    /^(?:unknown|undetermined|n\/a|na|none|not determined|(?:we )?could not determine(?: the license)?|(?:we )?couldn['’]t determine(?: the license)?)[.]?$/i;

export function isUndeterminedLicenseText(
    value: string | null | undefined,
): boolean {
    const text = value?.trim() ?? "";
    if (!text) return false;
    return UNDETERMINED_LICENSE_TEXT.test(text);
}

export type QuoteLicenseResult = "allowed" | "fail-closed" | "unknown";

/** `unknown` is fail-closed. It is named so the log can tell it from a known blocked license. */
export function quoteLicenseResult(
    eligibility: QuoteEligibility,
): QuoteLicenseResult {
    if (eligibility.allowed) return "allowed";
    if (eligibility.reason === "null_license") return "unknown";
    return "fail-closed";
}

/**
 * Why Discover quoted a paper or left its passage out. Display only: showing
 * a quote still goes through `licenseUrl` and `visiblePaperQuote`.
 */
export type QuoteGateReason =
    | QuoteBlockReason
    | "missing_attribution"
    | "no_passage";

export const QUOTE_GATE_REASONS = [
    "ok",
    "scholar_snippet",
    "abstract_only",
    "null_license",
    "license_not_commercial_friendly",
    "license_conflict",
    "missing_attribution",
    "no_passage",
] as const satisfies readonly QuoteGateReason[];

/** The license gate first, then the body, attribution, and passage checks after it. */
export function quoteGateReason(input: {
    eligibility: QuoteEligibility;
    abstractOnly: boolean;
    attributed: boolean;
    quoted: boolean;
}): QuoteGateReason {
    if (!input.eligibility.allowed) return input.eligibility.reason;
    if (input.abstractOnly) return "abstract_only";
    if (!input.attributed) return "missing_attribution";
    return input.quoted ? "ok" : "no_passage";
}

export function logQuoteDecision(input: {
    paperId: string;
    licenseResult: QuoteLicenseResult;
    quoteOmitted: boolean;
    titlePresent: boolean;
    linkPresent: boolean;
}): void {
    const paperId = input.paperId.trim();
    if (!paperId) return;
    console.info(
        JSON.stringify({
            event: "quote_decision",
            paperId,
            licenseResult: input.licenseResult,
            quoteOmitted: input.quoteOmitted,
            titlePresent: input.titlePresent,
            linkPresent: input.linkPresent,
        }),
    );
}

function httpUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (url.username || url.password) return null;
        return url.toString();
    } catch {
        return null;
    }
}

/** DOI, then an http(s) paper URL, then an in-app paper path. */
export function resolvableQuoteLink(input: {
    doi?: string | null;
    href?: string | null;
    sourceUrl?: string | null;
}): string | null {
    const doi = (input.doi ?? "")
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
    if (doi && !/\s/.test(doi)) return `https://doi.org/${doi}`;
    const source = httpUrl((input.sourceUrl ?? "").trim());
    if (source) return source;
    const href = (input.href ?? "").trim();
    const hrefUrl = httpUrl(href);
    if (hrefUrl) return hrefUrl;
    if (href.startsWith("/") && !href.startsWith("//")) return href;
    return null;
}

/** A shown quote includes the passage, the paper title, and a resolvable link. */
export function attributedQuote(input: {
    quote?: string | null;
    title?: string | null;
    link?: string | null;
}): { quote: string; title: string; link: string } | null {
    const quote = input.quote?.trim() ?? "";
    const title = input.title?.trim() ?? "";
    const link = input.link?.trim() ?? "";
    if (!quote || !title || !link) return null;
    return { quote, title, link };
}

/**
 * Paper-body quote for display. Missing, empty, unrecognized, and undetermined
 * licenses omit the passage. A commercial-friendly license still needs a title and link.
 */
export function visiblePaperQuote(input: {
    quote?: string | null;
    title?: string | null;
    doi?: string | null;
    href?: string | null;
    sourceUrl?: string | null;
    licenseUrl?: string | null;
}): { quote: string; title: string; link: string } | null {
    if (
        !input.licenseUrl?.trim() ||
        isUndeterminedLicenseText(input.licenseUrl) ||
        !isCommercialFriendlyLicenseUri(input.licenseUrl)
    ) {
        return null;
    }
    return attributedQuote({
        quote: input.quote,
        title: input.title,
        link: resolvableQuoteLink(input),
    });
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

    // Missing, empty, and undetermined licenses fail closed the same way a
    // known blocked license does: no verbatim passage. A commercial-friendly
    // URL still counts as determined.
    if (
        access.normalizedLicense === "UNKNOWN" ||
        (!isCommercialFriendlyLicense(access.normalizedLicense) &&
            (isUndeterminedLicenseText(input.rawLicense) ||
                isUndeterminedLicenseText(input.licenseUrl)))
    ) {
        return {
            allowed: false,
            reason: "null_license",
            license: "UNKNOWN",
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

/** Strict quote gate for showing a paper's text to other people. */
export function isPaperQuotable(
    paper: {
        source?: string | null;
        contentLabel?: string | null;
        paper?: Array<{ title?: string; content?: string }> | null;
        access: { rawLicense?: string | null; licenseUrl?: string | null };
    },
    database: string,
): boolean {
    const licenses = quoteLicenseFromHome(paper.access);
    return evaluateQuoteEligibility({
        source: paper.source || database,
        database,
        contentLabel: paper.contentLabel,
        hasFullTextBody: paperHasFullTextBody(paper),
        rawLicense: licenses.rawLicense,
        licenseUrl: licenses.licenseUrl,
    }).allowed;
}
