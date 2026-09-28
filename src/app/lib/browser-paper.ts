import type {
    BrowserFullTextSource,
    PaperFigure,
    Section,
} from "../api/general-interfaces";
import { parseArticleXml } from "../api/section-paser";
import { resolvePmcMediaUrl } from "./pmc-media";
import { paperHasFullTextBody } from "./quote-eligibility";

// Browser-side reads for papers whose license keeps the body off our servers.
// The visitor's browser asks NIH (or Europe PMC) directly, the way it would
// on pmc.ncbi.nlm.nih.gov. Nothing loaded here is sent back to the app.

const NCBI_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const EUROPE_PMC_REST = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const IMAGE_HOSTS = new Set([
    "pmc.ncbi.nlm.nih.gov",
    "cdn.ncbi.nlm.nih.gov",
    "pmc-oa-opendata.s3.amazonaws.com",
]);

export function browserFullTextUrls(pmcid: string): string[] {
    const id = pmcid.replace(/\D/g, "");
    if (!id) return [];
    const efetch = new URL(NCBI_EFETCH);
    efetch.searchParams.set("db", "pmc");
    efetch.searchParams.set("id", id);
    efetch.searchParams.set("tool", "ExpansiveMind");
    return [efetch.toString(), `${EUROPE_PMC_REST}/PMC${id}/fullTextXML`];
}

function imageResolver(mediaUrls: Record<string, string>) {
    return (sourceRef: string) => {
        try {
            const url = new URL(sourceRef);
            if (url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname)) {
                return url.toString();
            }
        } catch {
            // Relative refs resolve through the PMC Cloud manifest below.
        }
        return resolvePmcMediaUrl(sourceRef, mediaUrls);
    };
}

// Figures loaded this way are for reading only, never for figure analysis.
function readOnlyFigures(sections: Section[]): Section[] {
    const lock = (figures?: PaperFigure[]) =>
        figures?.map((figure) => ({
            ...figure,
            canAnalyzeSourceImage: false,
            displayOnly: Boolean(figure.imageUrl),
        }));
    return sections.map((section) => ({
        ...section,
        figures: lock(section.figures),
        subSections: section.subSections.map((subSection) => ({
            ...subSection,
            figures: lock(subSection.figures),
        })),
    }));
}

/** Parse JATS XML; null when it has no body beyond the abstract. */
export function parseBrowserFullText(
    xml: string,
    mediaUrls: Record<string, string>,
): Section[] | null {
    const sections = parseArticleXml(xml, imageResolver(mediaUrls));
    if (!paperHasFullTextBody({ paper: sections })) return null;
    return readOnlyFigures(sections);
}

export async function loadBrowserFullText(
    source: BrowserFullTextSource,
    signal?: AbortSignal,
): Promise<Section[] | null> {
    for (const url of browserFullTextUrls(source.pmcid)) {
        try {
            const response = await fetch(url, {
                signal,
                credentials: "omit",
                referrerPolicy: "no-referrer",
            });
            if (!response.ok) continue;
            const sections = parseBrowserFullText(
                await response.text(),
                source.mediaUrls,
            );
            if (sections) return sections;
        } catch (error) {
            if (signal?.aborted) throw error;
        }
    }
    return null;
}
