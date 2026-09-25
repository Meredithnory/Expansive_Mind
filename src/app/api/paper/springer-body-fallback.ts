import type { FormattedPaper, Section } from "../general-interfaces";

const EUROPE_PMC_SEARCH =
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export const SPRINGER_OPEN_BODY_NOTICE =
    "Springer Nature did not include article body text for this record. Full text was loaded from NIH PubMed Central.";

const normalizeDoi = (doi: string) =>
    doi
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");

const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};

const asString = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

/** True when licensed sections include more than an abstract-only view. */
export function paperHasBodySections(
    sections: Section[] | undefined | null,
): boolean {
    if (!sections?.length) return false;
    return sections.some((section) => {
        if (/abstract/i.test(section.title)) return false;
        if (section.content?.trim()) return true;
        return (section.subSections || []).some((sub) =>
            Boolean(sub.content?.trim()),
        );
    });
}

/**
 * Resolve a DOI to a PMC numeric id via Europe PMC (IN_PMC only).
 * Same index pattern used for Crossref → PMC discovery.
 */
export async function findPmcIdForDoiViaEuropePmc(
    doi: string,
    fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
    const normalizedDoi = normalizeDoi(doi);
    if (!normalizedDoi) return null;

    const params = new URLSearchParams({
        query: `DOI:"${normalizedDoi}" AND IN_PMC:Y`,
        format: "json",
        resultType: "lite",
        pageSize: "5",
    });

    const response = await fetchImpl(`${EUROPE_PMC_SEARCH}?${params}`, {
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const data = record(await response.json());
    const results = record(data.resultList).result;
    const list = Array.isArray(results) ? results : [];

    for (const item of list) {
        const row = record(item);
        const itemDoi = normalizeDoi(asString(row.doi));
        if (
            itemDoi &&
            itemDoi.toLowerCase() !== normalizedDoi.toLowerCase()
        ) {
            continue;
        }
        const pmcid = asString(row.pmcid).match(/^PMC([1-9]\d*)$/i)?.[1];
        if (pmcid) return pmcid;
    }

    return null;
}

export type SpringerIdentity = {
    title: string;
    authors: string[];
    paperId: string;
    idName: string;
    primarySource: string;
    abstract?: string;
    publicationDate?: string;
    canonicalUrl: string;
};

/**
 * Keep Springer routing identity while adopting PMC body text + PMC license
 * for the content actually shown and sent to the paper chatbot.
 */
export function adoptPmcBodyForSpringerPaper(
    springer: SpringerIdentity,
    pmcPaper: FormattedPaper,
): FormattedPaper | null {
    if (
        !pmcPaper.access.canDisplayFullText ||
        !paperHasBodySections(pmcPaper.paper)
    ) {
        return null;
    }

    return {
        ...pmcPaper,
        title: pmcPaper.title || springer.title,
        authors:
            pmcPaper.authors.length > 0
                ? pmcPaper.authors
                : springer.authors,
        paperId: springer.paperId,
        idName: springer.idName,
        primarySource: springer.primarySource,
        source: "springer",
        abstract: pmcPaper.abstract || springer.abstract,
        publicationDate:
            pmcPaper.publicationDate || springer.publicationDate,
        access: {
            ...pmcPaper.access,
            attribution: {
                ...pmcPaper.access.attribution,
                title: pmcPaper.title || springer.title,
                authors:
                    pmcPaper.authors.length > 0
                        ? pmcPaper.authors
                        : springer.authors,
                sourceLabel: springer.primarySource,
                paperId: springer.paperId,
                idName: springer.idName,
                doi: springer.paperId,
                publicationDate:
                    pmcPaper.publicationDate || springer.publicationDate,
                // PMC host URL documents where the body text came from.
                canonicalUrl:
                    pmcPaper.access.canonicalUrl || springer.canonicalUrl,
            },
        },
        contentNotice: SPRINGER_OPEN_BODY_NOTICE,
    };
}

export type LoadPmcPaper = (
    pmcid: string,
    primarySource: string,
    idName?: string,
) => Promise<FormattedPaper | null>;

/**
 * Resolve DOI → PMC via Europe PMC, then load license-checked full text.
 * Used when Springer JATS has metadata/abstract but no article <body>.
 */
export async function loadOpenFullTextForSpringerDoi(input: {
    doi: string;
    title: string;
    authors: string[];
    primarySource: string;
    idName: string;
    abstract?: string;
    publicationDate?: string;
    canonicalUrl: string;
    findPmcId?: typeof findPmcIdForDoiViaEuropePmc;
    loadPmcPaper: LoadPmcPaper;
}): Promise<FormattedPaper | null> {
    try {
        const findPmcId = input.findPmcId || findPmcIdForDoiViaEuropePmc;
        const pmcid = await findPmcId(input.doi);
        if (!pmcid) return null;

        const pmcPaper = await input.loadPmcPaper(
            pmcid,
            "NIH PubMed Central",
            "pmcid",
        );
        if (!pmcPaper) return null;

        return adoptPmcBodyForSpringerPaper(
            {
                title: input.title,
                authors: input.authors,
                paperId: input.doi,
                idName: input.idName,
                primarySource: input.primarySource,
                abstract: input.abstract,
                publicationDate: input.publicationDate,
                canonicalUrl: input.canonicalUrl,
            },
            pmcPaper,
        );
    } catch {
        return null;
    }
}
