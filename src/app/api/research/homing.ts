import { evaluateContentAccess } from "../../lib/content-access-policy";
import { PAPER_SOURCES } from "../../lib/paper-sources";
import {
    doiUrl,
    locatorFromPmcid,
    normalizeCitation,
    normalizeDoi,
    normalizePmcid,
} from "../../lib/research-citation";
import type { DiscoverCandidate } from "../discover/select-candidates";
import type { WorkLead } from "./types";

export function homeLead(lead: WorkLead): DiscoverCandidate | null {
    const pmcid = normalizePmcid(lead.pmcid);
    if (!pmcid) return null;

    const locator = locatorFromPmcid(pmcid);
    if (!locator) return null;

    const citation = normalizeCitation({
        ...lead.citation,
        doi: lead.citation.doi,
    });
    const sourceUrl =
        citation.url ||
        (citation.doi ? doiUrl(citation.doi) : "") ||
        `https://pmc.ncbi.nlm.nih.gov/articles/PMC${pmcid}/`;
    const title = citation.title;
    const authors = citation.authors;
    const access = evaluateContentAccess({
        source: "nih",
        rawLicense: lead.licenseHint || null,
        licenseUrl: lead.licenseUrl || null,
        attribution: {
            title,
            authors,
            sourceLabel: PAPER_SOURCES.nih.label,
            canonicalUrl: sourceUrl,
            paperId: pmcid,
            idName: "pmcid",
            doi: citation.doi,
            publicationDate: citation.date,
        },
    });

    return {
        database: "nih",
        paperId: pmcid,
        idName: "pmcid",
        title,
        authors,
        date: citation.date || "",
        abstract: lead.abstract,
        sourceLabel: PAPER_SOURCES.nih.label,
        sourceUrl,
        doi: citation.doi || normalizeDoi(lead.citation.doi) || undefined,
        access,
    };
}
