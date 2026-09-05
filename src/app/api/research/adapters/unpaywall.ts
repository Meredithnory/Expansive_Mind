import "server-only";
import { normalizeLicense } from "../../../lib/content-access-policy";
import { normalizeDoi } from "../../../lib/research-citation";
import { providerFetchJson } from "../http";
import type { OaEvidence, OpenAccessLocator } from "../types";

export function isUnpaywallConfigured(): boolean {
    return Boolean(process.env.UNPAYWALL_EMAIL);
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseUnpaywallRecord(
    raw: unknown,
    doi: string,
): OaEvidence | null {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const best =
        record.best_oa_location && typeof record.best_oa_location === "object"
            ? (record.best_oa_location as Record<string, unknown>)
            : null;
    if (!best) {
        return { doi };
    }
    const rawLicense = asString(best.license) || null;
    const normalized = normalizeLicense(rawLicense, rawLicense);
    return {
        doi,
        bestUrl: asString(best.url),
        pdfUrl: asString(best.url_for_pdf),
        rawLicense,
        licenseUrl: normalized.licenseUrl,
        version: asString(best.version),
        hostType: asString(best.host_type),
    };
}

export const unpaywallLocator: OpenAccessLocator = {
    id: "unpaywall",
    isConfigured: isUnpaywallConfigured,
    async locate(doi) {
        if (!isUnpaywallConfigured()) return null;
        const normalized = normalizeDoi(doi);
        const email = process.env.UNPAYWALL_EMAIL;
        if (!normalized || !email) return null;
        const url = new URL(`https://api.unpaywall.org/v2/${normalized}`);
        url.searchParams.set("email", email);
        const data = await providerFetchJson<unknown>(url);
        return parseUnpaywallRecord(data, normalized);
    },
};
