import convert from "xml-js";
import {
    extractArticleDetails,
    extractRelatedResearchArticle,
} from "../general-utils";
import {
    FormattedArticle,
    FormattedPaper,
    PaperFigure,
    RawArticle,
} from "../general-interfaces";
import { parseArticleXml } from "../section-paser";
import { DOMParser } from "@xmldom/xmldom";
import {
    canUseFigureImage,
    evaluateContentAccess,
    getContentAccessMode,
    normalizeLicense,
} from "../../lib/content-access-policy";
import {
    extractDoiFromJatsXml,
    extractLicenseFromJatsXml,
    hasParserError,
} from "../../lib/license-extract";
import { parseArticlesFromXml } from "../articleParser";
import { consumeRateLimit } from "../../lib/rate-limit";
import { abstractToText } from "../../lib/abstract-text";
import {
    PMC_OPEN_DATA_HOST,
    buildPmcMediaLookup,
    resolvePmcMediaUrl,
} from "../../lib/pmc-media";
import { buildSpringerImageUrl } from "../../lib/springer-media";
//Base URL and NIH KEY
const NIH_API_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const NIH_EUTILS_BASE =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NIH_API_KEY = process.env.API_KEY;
const NCBI_EMAIL = process.env.NCBI_EMAIL;
const NCBI_TOOL = process.env.NCBI_TOOL || "ExpansiveMind";
const PMC_OAI_URL = "https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/";
const PMC_CLOUD_URL = "https://pmc-oa-opendata.s3.amazonaws.com/";
const SPRINGER_JATS_URL = "https://api.springernature.com/openaccess/jats";
const SPRINGER_API_KEY = process.env.SPRINGER_API_KEY;
const SERPAPI_URL = "https://serpapi.com/search.json";
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SOURCE_IMAGE_HOSTS = new Set([
    "pmc.ncbi.nlm.nih.gov",
    "cdn.ncbi.nlm.nih.gov",
    PMC_OPEN_DATA_HOST,
    "media.springernature.com",
    "static-content.springer.com",
    "link.springer.com",
]);

const normalizePmcId = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const digits = raw.toString().trim().replace(/^PMC/i, "").replace(/\D/g, "");
    return digits || null;
};

const safeSourceImageUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && SOURCE_IMAGE_HOSTS.has(url.hostname)
            ? url.toString()
            : "";
    } catch {
        return "";
    }
};

const buildPmcImageUrl = (
    sourceRef: string,
    mediaUrls: Record<string, string>,
) => {
    const absolute = safeSourceImageUrl(sourceRef);
    if (absolute) return absolute;
    return resolvePmcMediaUrl(sourceRef, mediaUrls);
};

const applyFigureRights = (
    sections: FormattedPaper["paper"],
    articleAllowsImages: boolean,
) => {
    const figures: PaperFigure[] = [];
    const update = (figure: PaperFigure) => {
        const canAnalyzeSourceImage =
            canUseFigureImage({ ...figure, articleAllowsImages }) &&
            Boolean(figure.imageUrl);
        const updated = { ...figure, canAnalyzeSourceImage };
        figures.push(updated);
        return updated;
    };

    for (const section of sections) {
        section.figures = (section.figures || []).map(update);
        for (const subSection of section.subSections) {
            subSection.figures = (subSection.figures || []).map(update);
        }
    }
    return figures;
};
const fetchWithTimeout = async (
    input: string | URL,
    init: RequestInit = {},
    timeoutMs = 12_000,
) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
};

const addNcbiIdentification = (params: URLSearchParams) => {
    if (!NCBI_EMAIL) {
        throw new Error(
            "NCBI_EMAIL is required so NCBI can identify this application.",
        );
    }
    params.set("tool", NCBI_TOOL);
    params.set("email", NCBI_EMAIL);
    if (NIH_API_KEY) params.set("api_key", NIH_API_KEY);
};

const enforceOutboundLimit = async (
    scope: string,
    limit: number,
    windowMs: number,
) => {
    const result = await consumeRateLimit({
        scope: `outbound-${scope}`,
        identity: "global",
        limit,
        windowMs,
    });
    if (!result.allowed) {
        throw new Error(`${scope} request limit reached.`);
    }
};

interface PmcRightsMetadata {
    rawLicense: string | null;
    licenseUrl: string | null;
    isRetracted: boolean;
    hasConflictingLicenseData: boolean;
    frontMatterXml: string;
    mediaUrls: Record<string, string>;
}

const getPmcCloudMetadata = async (pmcid: string) => {
    const listUrl = new URL(PMC_CLOUD_URL);
    listUrl.searchParams.set("list-type", "2");
    listUrl.searchParams.set("prefix", `metadata/PMC${pmcid}.`);

    const listResponse = await fetchWithTimeout(listUrl);
    if (!listResponse.ok) return null;
    const listXml = await listResponse.text();
    const doc = new DOMParser().parseFromString(listXml, "application/xml");
    const keys = Array.from(doc.getElementsByTagName("Key"))
        .map((node) => node.textContent?.trim() || "")
        .filter((key) => /^metadata\/PMC\d+\.\d+\.json$/.test(key))
        .sort((a, b) => {
            const aVersion = Number(a.match(/\.(\d+)\.json$/)?.[1] || 0);
            const bVersion = Number(b.match(/\.(\d+)\.json$/)?.[1] || 0);
            return bVersion - aVersion;
        });
    if (!keys[0]) return null;

    const metadataResponse = await fetchWithTimeout(
        `${PMC_CLOUD_URL}${keys[0]}`,
    );
    if (!metadataResponse.ok) return null;
    return metadataResponse.json();
};

const getPmcRightsMetadata = async (
    pmcid: string,
): Promise<PmcRightsMetadata> => {
    const oaiParams = new URLSearchParams({
        verb: "GetRecord",
        identifier: `oai:pubmedcentral.nih.gov:${pmcid}`,
        metadataPrefix: "pmc_fm",
    });
    await enforceOutboundLimit("ncbi", NIH_API_KEY ? 9 : 2, 1_000);
    const oaiResponse = await fetchWithTimeout(
        `${PMC_OAI_URL}?${oaiParams.toString()}`,
    );
    if (!oaiResponse.ok) {
        throw new Error(`PMC metadata lookup failed: ${oaiResponse.status}`);
    }
    const frontMatterXml = await oaiResponse.text();
    const oaiRights = extractLicenseFromJatsXml(frontMatterXml);

    let cloudMetadata: any = null;
    try {
        cloudMetadata = await getPmcCloudMetadata(pmcid);
    } catch {
        // OAI front matter remains the fail-closed metadata fallback.
    }

    const cloudLicense =
        typeof cloudMetadata?.license_code === "string"
            ? cloudMetadata.license_code
            : null;
    const cloudNormalized = normalizeLicense(cloudLicense);
    const oaiNormalized = normalizeLicense(
        oaiRights.rawLicense,
        oaiRights.licenseUrl,
    );
    const conflict =
        cloudLicense &&
        oaiNormalized.normalizedLicense !== "UNKNOWN" &&
        cloudNormalized.normalizedLicense !== oaiNormalized.normalizedLicense;

    return {
        rawLicense: conflict
            ? `${cloudLicense}; ${oaiRights.rawLicense || "OAI unknown"}`
            : cloudLicense || oaiRights.rawLicense,
        licenseUrl: oaiRights.licenseUrl,
        isRetracted: Boolean(cloudMetadata?.is_retracted),
        hasConflictingLicenseData: Boolean(conflict),
        frontMatterXml,
        mediaUrls: buildPmcMediaLookup(cloudMetadata?.media_urls),
    };
};

//Function to get paper details from PMID passed into the function to get paper details
export const getPaperDetails = async (
    pmcid: string,
    primarySource: string,
    idName: string = "pmcid",
): Promise<FormattedPaper | null> => {
    const normalizedId = normalizePmcId(pmcid);
    if (!normalizedId) return null;

    let rightsMetadata: PmcRightsMetadata;
    try {
        rightsMetadata = await getPmcRightsMetadata(normalizedId);
    } catch (error) {
        if (getContentAccessMode() === "strict") throw error;
        rightsMetadata = {
            rawLicense: null,
            licenseUrl: null,
            isRetracted: false,
            hasConflictingLicenseData: false,
            frontMatterXml: "",
            mediaUrls: {},
        };
    }
    if (Object.keys(rightsMetadata.mediaUrls).length === 0) {
        try {
            const cloudMetadata = await getPmcCloudMetadata(normalizedId);
            rightsMetadata.mediaUrls = buildPmcMediaLookup(
                cloudMetadata?.media_urls,
            );
        } catch {
            // Figure URLs stay empty when the cloud manifest is unavailable.
        }
    }
    const metadata = rightsMetadata.frontMatterXml
        ? parseArticlesFromXml(rightsMetadata.frontMatterXml)[0]
        : undefined;
    const canonicalUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${normalizedId}/`;
    const metadataTitle = metadata?.title || "Untitled";
    const metadataAuthors = metadata?.authors || [];
    const metadataAbstract = Array.isArray(metadata?.abstract)
        ? metadata.abstract.join("\n\n")
        : metadata?.abstract || "";

    const access = evaluateContentAccess({
        source: "nih",
        rawLicense: rightsMetadata.rawLicense,
        licenseUrl: rightsMetadata.licenseUrl,
        hasConflictingLicenseData:
            rightsMetadata.hasConflictingLicenseData,
        attribution: {
            title: metadataTitle,
            authors: metadataAuthors,
            sourceLabel: primarySource,
            canonicalUrl,
            paperId: normalizedId,
            idName,
            publicationDate: metadata?.date || undefined,
        },
    });

    if (!access.canDisplayFullText) {
        return {
            title: metadataTitle,
            authors: metadataAuthors,
            paperId: normalizedId,
            idName,
            primarySource,
            source: "nih",
            paper: [],
            abstract: metadataAbstract || undefined,
            publicationDate: metadata?.date || undefined,
            contentLabel: "Abstract",
            access,
            status: {
                isRetracted: rightsMetadata.isRetracted,
                relatedUpdates: [],
            },
            contentNotice: access.policyReason,
        };
    }

    const params = new URLSearchParams();
    params.set("id", normalizedId);
    params.set("db", "pmc");
    addNcbiIdentification(params);
    await enforceOutboundLimit("ncbi", NIH_API_KEY ? 9 : 2, 1_000);
    const res = await fetchWithTimeout(`${NIH_API_URL}?${params}`);
    if (!res.ok) {
        throw new Error(`PMC full-text request failed: ${res.status}`);
    }
    const dataAsXML = await res.text();

    const dataAsJSON = JSON.parse(
        convert.xml2json(dataAsXML, { compact: true })
    );
    let paperSections = parseArticleXml(dataAsXML, (sourceRef) =>
        buildPmcImageUrl(sourceRef, rightsMetadata.mediaUrls),
    );

    //Convert XML 2 JSON and make it compact names - gives us keys that we can drill into - compact gives us an arr or an obj so thats way we have to check if its arr or an obj in the interface and drill even more if needed to access the ._text
    //This is the raw article that is parsed through the dataAsJSON
    const article: RawArticle = dataAsJSON["pmc-articleset"].article;
    //Made a function that extracts the article details - using the way we got the search results to get the article details that we will still extract in the backend for the paper from raw article
    const articleDetails: FormattedArticle | null =
        extractArticleDetails(article);
    if (!articleDetails) {
        return null;
    }

    if (
        paperSections.length === 0 &&
        articleDetails.abstract.trim().length > 0
    ) {
        paperSections = [
            {
                title: "Abstract",
                content: articleDetails.abstract,
                subSections: [],
            },
        ];
    }
    const figures = applyFigureRights(paperSections, access.canUseImages);

    const relatedResearchArticle = extractRelatedResearchArticle(dataAsXML);
    const shouldRedirect =
        relatedResearchArticle &&
        relatedResearchArticle.pmcid !== normalizedId;

    return {
        title: articleDetails.title,
        authors: articleDetails.authors,
        paperId: normalizedId,
        idName,
        primarySource,
        source: "nih",
        paper: paperSections,
        figures,
        abstract: articleDetails.abstract || undefined,
        publicationDate: articleDetails.date || undefined,
        contentLabel: "Abstract",
        access: {
            ...access,
            canUseImages: figures.some(
                (figure) => figure.canAnalyzeSourceImage,
            ),
            attribution: {
                ...access.attribution,
                title: articleDetails.title,
                authors: articleDetails.authors,
                publicationDate: articleDetails.date || undefined,
                doi: extractDoiFromJatsXml(dataAsXML) || undefined,
            },
        },
        status: {
            isRetracted: rightsMetadata.isRetracted,
            articleType: article?._attributes?.["article-type"],
            relatedUpdates: relatedResearchArticle
                ? [relatedResearchArticle]
                : [],
        },
        ...(shouldRedirect ? { relatedResearchArticle } : {}),
    };
};

const extractSpringerMetadataFromJats = (xmlString: string) => {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const title =
        doc.getElementsByTagName("article-title")[0]?.textContent?.trim() ||
        "";

    const authors: string[] = [];
    Array.from(doc.getElementsByTagName("contrib")).forEach((node) => {
        const contrib = node as Element;
        if (contrib.getAttribute("contrib-type") !== "author") return;

        const name = contrib.getElementsByTagName("name")[0];
        if (!name) return;

        const surname =
            name.getElementsByTagName("surname")[0]?.textContent?.trim() || "";
        const given =
            name.getElementsByTagName("given-names")[0]?.textContent?.trim() ||
            "";

        if (surname && given) {
            authors.push(`${surname}, ${given}`);
        } else if (surname) {
            authors.push(surname);
        }
    });

    const abstractEl = doc.getElementsByTagName("abstract")[0];
    const abstract = abstractEl
        ? Array.from(abstractEl.getElementsByTagName("p"))
              .map((p) => (p as Element).textContent?.trim() || "")
              .filter(Boolean)
              .join("\n\n")
        : "";

    const versionEl = doc.getElementsByTagName("article-version")[0];
    const articleVersion =
        versionEl?.getAttribute("article-version-type") || null;
    const hasBody = doc.getElementsByTagName("body").length > 0;

    return { title, authors, abstract, articleVersion, hasBody };
};

const buildSpringerContentNotice = (
    hasBody: boolean,
    articleVersion: string | null,
): string | undefined => {
    if (hasBody) return undefined;

    if (articleVersion === "AM") {
        return "Springer Nature has only published an accepted manuscript for this article. Full text sections are not yet available through their API — only the abstract is shown here.";
    }

    return "Full article body text is not available from Springer Nature for this record — only metadata and abstract are shown here.";
};

const prependAbstractSection = (
    sections: FormattedPaper["paper"],
    abstract?: string,
) => {
    const abstractText = abstract?.trim();
    if (!abstractText) return sections;

    const hasAbstract = sections.some((section) =>
        section.title.toLowerCase().includes("abstract"),
    );
    if (hasAbstract) return sections;

    return [
        { title: "Abstract", content: abstractText, subSections: [] },
        ...sections,
    ];
};

const normalizeDoi = (doi: string) =>
    doi
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/doi\.org\//i, "");

export const getSpringerPaperDetails = async (
    doi: string,
    primarySource: string,
    idName: string = "doi",
    fallback?: {
        title?: string;
        authors?: string[];
        abstract?: string;
    },
): Promise<FormattedPaper> => {
    if (!SPRINGER_API_KEY) {
        throw Error("Invalid Springer API Key");
    }

    const normalizedDoi = normalizeDoi(doi);
    const jsonMetadata = (await getSpringerPaperMetadata([normalizedDoi]))[0];
    const title = jsonMetadata?.title || fallback?.title || "Untitled";
    const authors =
        (jsonMetadata?.authors?.length ?? 0) > 0
            ? jsonMetadata!.authors
            : fallback?.authors || [];
    const abstract = jsonMetadata?.abstract || fallback?.abstract || "";
    const canonicalUrl =
        jsonMetadata?.canonicalUrl || `https://doi.org/${normalizedDoi}`;
    const initialAccess = evaluateContentAccess({
        source: "springer",
        rawLicense: jsonMetadata?.rawLicense || null,
        licenseUrl: jsonMetadata?.licenseUrl || null,
        attribution: {
            title,
            authors,
            sourceLabel: primarySource,
            canonicalUrl,
            paperId: normalizedDoi,
            idName,
            publicationDate: jsonMetadata?.publicationDate,
            publicationName: jsonMetadata?.publicationName,
            publisher: jsonMetadata?.publisher,
            doi: normalizedDoi,
        },
    });

    if (!initialAccess.canDisplayFullText) {
        return {
            title,
            authors,
            paperId: normalizedDoi,
            idName,
            primarySource,
            source: "springer",
            paper: [],
            abstract: abstract || undefined,
            publicationDate: jsonMetadata?.publicationDate,
            contentLabel: "Abstract",
            access: initialAccess,
            contentNotice: initialAccess.policyReason,
        };
    }

    const params = new URLSearchParams();
    params.append("api_key", SPRINGER_API_KEY);
    params.append("q", `doi:${normalizedDoi}`);
    params.append("p", "1");

    await enforceOutboundLimit("springer", 80, 60_000);
    const res = await fetchWithTimeout(
        `${SPRINGER_JATS_URL}?${params.toString()}`,
    );
    // JATS is often missing even when JSON metadata exists; fall back to abstract.
    if (!res.ok) {
        return {
            title,
            authors,
            paperId: normalizedDoi,
            idName,
            primarySource,
            source: "springer",
            paper: prependAbstractSection([], abstract),
            abstract: abstract || undefined,
            publicationDate: jsonMetadata?.publicationDate,
            contentLabel: "Abstract",
            access: initialAccess,
            contentNotice:
                abstract
                    ? "Full text was unavailable from Springer Nature for this record — only the abstract is shown here."
                    : buildSpringerContentNotice(false, null),
        };
    }

    const dataAsXML = await res.text();
    const hasArticle =
        !hasParserError(dataAsXML) &&
        /<(?:\w+:)?article(?:\s|>)/i.test(dataAsXML);
    const jatsMetadata = hasArticle
        ? extractSpringerMetadataFromJats(dataAsXML)
        : null;
    const jatsRights = hasArticle
        ? extractLicenseFromJatsXml(dataAsXML)
        : null;
    const jsonNormalized = normalizeLicense(
        jsonMetadata?.rawLicense,
        jsonMetadata?.licenseUrl,
    );
    const jatsNormalized = normalizeLicense(
        jatsRights?.rawLicense,
        jatsRights?.licenseUrl,
    );
    const hasConflict =
        jatsNormalized.normalizedLicense !== "UNKNOWN" &&
        jatsNormalized.normalizedLicense !==
            jsonNormalized.normalizedLicense;
    const access = evaluateContentAccess({
        source: "springer",
        rawLicense: jatsRights?.rawLicense || jsonMetadata?.rawLicense || null,
        licenseUrl:
            jatsRights?.licenseUrl || jsonMetadata?.licenseUrl || null,
        hasConflictingLicenseData: hasConflict,
        attribution: {
            ...initialAccess.attribution,
            title: jatsMetadata?.title || title,
            authors:
                (jatsMetadata?.authors?.length ?? 0) > 0
                    ? jatsMetadata!.authors
                    : authors,
            copyrightStatement:
                jatsRights?.copyrightStatement || undefined,
        },
    });
    const resolvedTitle = jatsMetadata?.title || title;
    const resolvedAuthors =
        (jatsMetadata?.authors?.length ?? 0) > 0
            ? jatsMetadata!.authors
            : authors;
    const resolvedAbstract = jatsMetadata?.abstract || abstract;

    const contentNotice = jatsMetadata
        ? buildSpringerContentNotice(
              jatsMetadata.hasBody,
              jatsMetadata.articleVersion,
          )
        : undefined;

    if (!hasArticle || !access.canDisplayFullText) {
        return {
            title: resolvedTitle,
            authors: resolvedAuthors,
            paperId: normalizedDoi,
            idName,
            primarySource,
            source: "springer",
            paper: [],
            abstract: resolvedAbstract || undefined,
            publicationDate: jsonMetadata?.publicationDate,
            contentLabel: "Abstract",
            access,
            contentNotice: !access.canDisplayFullText
                ? access.policyReason
                : contentNotice,
        };
    }

    const paperSections = prependAbstractSection(
        parseArticleXml(dataAsXML, (sourceRef) =>
            buildSpringerImageUrl(sourceRef, normalizedDoi),
        ),
        resolvedAbstract,
    );
    const figures = applyFigureRights(paperSections, access.canUseImages);

    return {
        title: resolvedTitle,
        authors: resolvedAuthors,
        paperId: normalizedDoi,
        idName,
        primarySource,
        source: "springer",
        paper: paperSections,
        figures,
        abstract: resolvedAbstract || undefined,
        publicationDate: jsonMetadata?.publicationDate,
        contentLabel: "Abstract",
        access: {
            ...access,
            canUseImages: figures.some(
                (figure) => figure.canAnalyzeSourceImage,
            ),
        },
        ...(contentNotice ? { contentNotice } : {}),
    };
};

export const getSpringerPaperMetadata = async (dois: string[]) => {
    if (!SPRINGER_API_KEY || dois.length === 0) {
        return [];
    }

    const results = await Promise.all(
        dois.map(async (doi) => {
            const normalizedDoi = normalizeDoi(doi);
            const params = new URLSearchParams();
            params.append("api_key", SPRINGER_API_KEY);
            params.append("q", `doi:${normalizedDoi}`);
            params.append("p", "1");

            try {
                await enforceOutboundLimit("springer", 80, 60_000);
                const res = await fetch(
                    `https://api.springernature.com/openaccess/json?${params.toString()}`,
                );
                if (!res.ok) return null;

                const data = await res.json();
                const record = data?.records?.[0];
                if (!record) return null;
                const returnedDoi = normalizeDoi(record?.doi || normalizedDoi);
                if (
                    returnedDoi.toLowerCase() !==
                    normalizedDoi.toLowerCase()
                ) {
                    return null;
                }

                const authors = Array.isArray(record?.creators)
                    ? record.creators
                          .map((creator: any) => creator?.creator)
                          .filter(Boolean)
                    : [];
                const urls = Array.isArray(record?.url) ? record.url : [];
                const canonicalUrl =
                    `https://doi.org/${normalizedDoi}` ||
                    record?.fullTextUrl ||
                    urls.find((url: any) =>
                        /springer/i.test(url?.platform || ""),
                    )?.value ||
                    urls.find((url: any) =>
                        /^https:\/\//i.test(url?.value || ""),
                    )?.value;
                const rawLicense =
                    typeof record?.license === "string"
                        ? record.license
                        : record?.license?.value ||
                          record?.license?.url ||
                          null;
                const normalizedLicense = normalizeLicense(rawLicense);

                return {
                    paperId: normalizedDoi,
                    title:
                        typeof record?.title === "string"
                            ? record.title
                            : abstractToText(record?.title) || "Untitled",
                    authors,
                    abstract:
                        abstractToText(record?.abstract) ||
                        "No abstract available from Springer Nature.",
                    rawLicense,
                    licenseUrl: normalizedLicense.licenseUrl,
                    canonicalUrl,
                    publicationDate: record?.publicationDate || undefined,
                    publicationName: record?.publicationName || undefined,
                    publisher: record?.publisher || "Springer Nature",
                };
            } catch {
                return null;
            }
        }),
    );

    return results.filter(Boolean);
};

const parseScholarAuthors = (record: any): string[] => {
    const authors = record?.publication_info?.authors;
    if (Array.isArray(authors) && authors.length > 0) {
        return authors
            .map((author: any) => author?.name)
            .filter(Boolean);
    }

    const summary = record?.publication_info?.summary || "";
    const beforeDash = summary.split(" - ")[0] || "";
    if (!beforeDash) return [];

    return beforeDash
        .split(",")
        .map((name: string) => name.trim())
        .filter(Boolean);
};

const fetchScholarRecordByCluster = async (clusterId: string) => {
    if (!SERPAPI_KEY) {
        return null;
    }

    const params = new URLSearchParams();
    params.append("engine", "google_scholar");
    params.append("cluster", clusterId);
    params.append("api_key", SERPAPI_KEY);

    await enforceOutboundLimit("serpapi", 60, 60_000);
    const res = await fetch(`${SERPAPI_URL}?${params.toString()}`);
    if (!res.ok) {
        return null;
    }

    const data = await res.json();
    return data?.organic_results?.[0] || null;
};

const normalizeComparableTitle = (title: string) =>
    title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

const titleSimilarity = (left: string, right: string) => {
    const leftTokens = new Set(normalizeComparableTitle(left).split(" "));
    const rightTokens = new Set(normalizeComparableTitle(right).split(" "));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
    const intersection = Array.from(leftTokens).filter((token) =>
        rightTokens.has(token),
    ).length;
    return intersection / Math.max(leftTokens.size, rightTokens.size);
};

const extractDoiFromScholarRecord = (record: any): string | null => {
    const candidates = [
        record?.link,
        record?.resources?.[0]?.link,
        record?.publication_info?.summary,
        record?.snippet,
    ].filter((value): value is string => typeof value === "string");

    for (const candidate of candidates) {
        let decoded = candidate;
        try {
            decoded = decodeURIComponent(candidate);
        } catch {
            // Keep the original text when it is not URI encoded.
        }
        const match = decoded.match(/\b10\.\d{4,9}\/[^\s?#&"<>]+/i);
        if (match) {
            return normalizeDoi(match[0].replace(/[).,;]+$/, ""));
        }
    }
    return null;
};

const findPmcIdForScholarRecord = async (
    title: string,
    doi: string | null,
): Promise<string | null> => {
    if (!NIH_API_KEY || !NCBI_EMAIL || !title.trim()) return null;

    const query = doi
        ? `("${doi.replace(/"/g, "")}"[DOI]) OR ("${title.replace(/"/g, "")}"[Title])`
        : `"${title.replace(/"/g, "")}"[Title]`;
    const searchParams = new URLSearchParams({
        db: "pmc",
        term: query,
        retmax: "5",
        retmode: "json",
    });
    addNcbiIdentification(searchParams);
    await enforceOutboundLimit("ncbi", NIH_API_KEY ? 9 : 2, 1_000);
    const searchResponse = await fetchWithTimeout(
        `${NIH_EUTILS_BASE}/esearch.fcgi?${searchParams}`,
    );
    if (!searchResponse.ok) return null;
    const searchData = await searchResponse.json();
    const ids: string[] = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return null;

    const summaryParams = new URLSearchParams({
        db: "pmc",
        id: ids.join(","),
        retmode: "json",
    });
    addNcbiIdentification(summaryParams);
    await enforceOutboundLimit("ncbi", NIH_API_KEY ? 9 : 2, 1_000);
    const summaryResponse = await fetchWithTimeout(
        `${NIH_EUTILS_BASE}/esummary.fcgi?${summaryParams}`,
    );
    if (!summaryResponse.ok) return null;
    const summaries = (await summaryResponse.json())?.result || {};

    const match = ids
        .map((id) => ({
            id,
            similarity: titleSimilarity(title, summaries[id]?.title || ""),
        }))
        .sort((left, right) => right.similarity - left.similarity)[0];
    return match?.similarity >= 0.9 ? match.id : null;
};

const resolveScholarPaper = async (
    record: any,
    fallback?: {
        title?: string;
        authors?: string[];
        abstract?: string;
    },
): Promise<FormattedPaper | null> => {
    const title = record?.title || fallback?.title || "";
    const authors =
        record && parseScholarAuthors(record).length > 0
            ? parseScholarAuthors(record)
            : fallback?.authors || [];
    const abstract = record?.snippet || fallback?.abstract || "";
    const doi = extractDoiFromScholarRecord(record);

    const pmcid = await findPmcIdForScholarRecord(title, doi).catch(
        () => null,
    );
    if (pmcid) {
        const paper = await getPaperDetails(
            pmcid,
            "NIH PubMed Central",
            "pmcid",
        ).catch(() => null);
        if (paper?.paper.length) {
            return {
                ...paper,
                contentNotice:
                    "This Google Scholar result was resolved to its NIH PubMed Central full-text record.",
            };
        }
    }

    if (doi && SPRINGER_API_KEY) {
        const paper = await getSpringerPaperDetails(
            doi,
            "Springer Nature",
            "doi",
            { title, authors, abstract },
        ).catch(() => null);
        if (paper?.paper.length) {
            return {
                ...paper,
                contentNotice:
                    "This Google Scholar result was resolved to its Springer Nature full-text record.",
            };
        }
    }

    return null;
};

export const getScholarPaperDetails = async (
    clusterId: string,
    primarySource: string,
    idName: string = "cluster_id",
    fallback?: {
        title?: string;
        authors?: string[];
        abstract?: string;
    },
): Promise<FormattedPaper> => {
    const record = await fetchScholarRecordByCluster(clusterId);
    const resolvedPaper = await resolveScholarPaper(record, fallback);
    if (resolvedPaper) return resolvedPaper;

    const title = record?.title || fallback?.title || "Untitled";
    const authors =
        record && parseScholarAuthors(record).length > 0
            ? parseScholarAuthors(record)
            : fallback?.authors || [];
    const abstract = record?.snippet || fallback?.abstract || "";
    const canonicalUrl =
        record?.link ||
        record?.resources?.[0]?.link ||
        `https://scholar.google.com/scholar?cluster=${encodeURIComponent(clusterId)}`;
    const access = evaluateContentAccess({
        source: "scholar",
        rawLicense: null,
        attribution: {
            title,
            authors,
            sourceLabel: primarySource,
            canonicalUrl,
            paperId: clusterId,
            idName,
        },
    });

    return {
        title,
        authors,
        paperId: clusterId,
        idName,
        primarySource,
        source: "scholar",
        paper: abstract
            ? [
                  {
                      title: "Search snippet",
                      content: abstract,
                      subSections: [],
                  },
              ]
            : [],
        abstract: abstract || undefined,
        contentLabel: "Search snippet",
        access,
        contentNotice: access.policyReason,
    };
};

export const getScholarPaperMetadata = async (clusterIds: string[]) => {
    if (!SERPAPI_KEY || clusterIds.length === 0) {
        return [];
    }

    const results = await Promise.all(
        clusterIds.map(async (clusterId) => {
            try {
                const record = await fetchScholarRecordByCluster(clusterId);
                if (!record) return null;

                return {
                    paperId: clusterId,
                    title: record?.title || "Untitled",
                    authors: parseScholarAuthors(record),
                    abstract:
                        record?.snippet ||
                        "No snippet available from Google Scholar.",
                    canonicalUrl:
                        record?.link ||
                        record?.resources?.[0]?.link ||
                        `https://scholar.google.com/scholar?cluster=${encodeURIComponent(clusterId)}`,
                    contentLabel: "Search snippet" as const,
                };
            } catch {
                return null;
            }
        }),
    );

    return results.filter(Boolean);
};
