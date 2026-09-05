import "server-only";
import { evaluateContentAccess } from "../../../lib/content-access-policy";
import { abstractToText } from "../../../lib/abstract-text";
import {
    extractDoiFromJatsXml,
    extractLicenseFromJatsXml,
} from "../../../lib/license-extract";
import { PAPER_SOURCES } from "../../../lib/paper-sources";
import {
    normalizeCitation,
    normalizeDoi,
    normalizePmcid,
} from "../../../lib/research-citation";
import type { FormattedPaper } from "../../general-interfaces";
import { parseArticleXml } from "../../section-paser";
import { providerFetchJson, providerFetchText } from "../http";
import type { WorkIndex, WorkLead } from "../types";

const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";

export function isEuropePmcConfigured(): boolean {
    return Boolean(process.env.EUROPEPMC_EMAIL);
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseEuropePmcRecord(raw: unknown): WorkLead | null {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const pmcid = normalizePmcid(
        asString(record.pmcid) || asString(record.pmcidList),
    );
    const doi = normalizeDoi(asString(record.doi));
    const authorsRaw = record.authorList;
    const authors: string[] = [];
    if (authorsRaw && typeof authorsRaw === "object") {
        const list = (authorsRaw as Record<string, unknown>).author;
        const items = Array.isArray(list) ? list : list ? [list] : [];
        for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const author = item as Record<string, unknown>;
            const full =
                asString(author.fullName) ||
                [asString(author.firstName), asString(author.lastName)]
                    .filter(Boolean)
                    .join(" ");
            if (full) authors.push(full);
        }
    }
    const licenseHint =
        asString(record.license) ||
        (record.isOpenAccess === "Y" ? null : asString(record.license));
    const citation = normalizeCitation({
        title: asString(record.title),
        authors,
        doi,
        date: asString(record.firstPublicationDate) || asString(record.pubYear),
        url: doi ? `https://doi.org/${doi}` : undefined,
    });
    return {
        producer: "europepmc",
        citation,
        abstract: abstractToText(record.abstractText) || "",
        ...(pmcid ? { pmcid } : {}),
        licenseHint: licenseHint || null,
        licenseUrl: null,
    };
}

export const europePmcIndex: WorkIndex = {
    id: "europepmc",
    isConfigured: isEuropePmcConfigured,
    async search({ query, page }) {
        if (!isEuropePmcConfigured() || page > 0) return [];
        const url = new URL(`${EUROPE_PMC}/search`);
        url.searchParams.set("query", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("resultType", "core");
        url.searchParams.set("pageSize", "10");
        url.searchParams.set("email", process.env.EUROPEPMC_EMAIL || "");
        const data = await providerFetchJson<{
            resultList?: { result?: unknown[] };
        }>(url);
        return (data?.resultList?.result ?? [])
            .map(parseEuropePmcRecord)
            .filter((lead): lead is WorkLead => Boolean(lead));
    },
    async resolveWork(doi) {
        if (!isEuropePmcConfigured()) return null;
        const normalized = normalizeDoi(doi);
        if (!normalized) return null;
        const url = new URL(`${EUROPE_PMC}/search`);
        url.searchParams.set("query", `DOI:${normalized}`);
        url.searchParams.set("format", "json");
        url.searchParams.set("resultType", "core");
        url.searchParams.set("pageSize", "1");
        url.searchParams.set("email", process.env.EUROPEPMC_EMAIL || "");
        const data = await providerFetchJson<{
            resultList?: { result?: unknown[] };
        }>(url);
        const first = data?.resultList?.result?.[0];
        return first ? parseEuropePmcRecord(first) : null;
    },
};

export async function fetchPmcFullTextViaEuropePmc(
    pmcid: string,
    primarySource: string,
    idName: string,
): Promise<FormattedPaper | null> {
    if (!isEuropePmcConfigured()) return null;
    const normalized = normalizePmcid(pmcid);
    if (!normalized) return null;

    const url = new URL(`${EUROPE_PMC}/PMC${normalized}/fullTextXML`);
    url.searchParams.set("email", process.env.EUROPEPMC_EMAIL || "");
    const xml = await providerFetchText(url);
    if (!xml) return null;

    const license = extractLicenseFromJatsXml(xml);
    const doi = extractDoiFromJatsXml(xml);
    const canonicalUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${normalized}/`;
    const access = evaluateContentAccess({
        source: "nih",
        rawLicense: license.rawLicense,
        licenseUrl: license.licenseUrl,
        attribution: {
            title: "Untitled",
            authors: [],
            sourceLabel: primarySource || PAPER_SOURCES.nih.label,
            canonicalUrl,
            paperId: normalized,
            idName,
            doi: doi || undefined,
        },
    });

    const paper = access.canDisplayFullText
        ? parseArticleXml(xml, () => "")
        : [];
    const title =
        paper.find((section) => section.title)?.title ||
        access.attribution.title;
    const abstract = paper.find((section) =>
        /abstract/i.test(section.title),
    )?.content;

    return {
        title,
        authors: access.attribution.authors,
        paperId: normalized,
        idName,
        primarySource: primarySource || PAPER_SOURCES.nih.label,
        source: "nih",
        paper,
        abstract,
        contentLabel: "Abstract",
        access: {
            ...access,
            attribution: {
                ...access.attribution,
                title,
                doi: doi || undefined,
            },
        },
        contentNotice: access.canDisplayFullText
            ? undefined
            : access.policyReason,
    };
}
