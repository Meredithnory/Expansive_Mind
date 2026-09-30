import type { FormattedPaper } from "../general-interfaces";

/**
 * Where a Google Scholar result's text may come from. Scholar gives only a
 * snippet, so a result is read from its full-text home or not at all:
 *
 * 1. PubMed Central, found by NCBI search (DOI or title) or, if that fails,
 *    by exact DOI through Europe PMC, so one NCBI error can't misroute it.
 * 2. Springer Nature, only when Springer actually has the DOI. A Wiley or
 *    Frontiers DOI is not a Springer paper, and the Scholar snippet must
 *    never stand in for a Springer abstract.
 *
 * Otherwise null: the caller keeps it as a Scholar snippet, which Discover
 * does not read.
 */
export async function homeScholarResult(input: {
    doi: string | null;
    /** NCBI esearch by DOI or title, matched on title. */
    findPmcidBySearch: () => Promise<string | null>;
    /** Exact DOI to PMCID through Europe PMC. */
    findPmcidByDoi: (doi: string) => Promise<string | null>;
    loadPmc: (pmcid: string) => Promise<FormattedPaper | null>;
    /** Springer Nature's own record for the DOI, or null when it has none. */
    springerHasDoi: (doi: string) => Promise<boolean>;
    loadSpringer: (doi: string) => Promise<FormattedPaper | null>;
}): Promise<FormattedPaper | null> {
    const quiet = <T,>(work: Promise<T>) => work.catch(() => null);

    let pmcid = await quiet(input.findPmcidBySearch());
    if (!pmcid && input.doi) pmcid = await quiet(input.findPmcidByDoi(input.doi));
    if (pmcid) {
        const paper = await quiet(input.loadPmc(pmcid));
        if (paper?.paper.length) {
            return {
                ...paper,
                contentNotice:
                    "This Google Scholar result was resolved to its NIH PubMed Central full-text record.",
            };
        }
    }

    if (input.doi && (await quiet(input.springerHasDoi(input.doi)))) {
        const paper = await quiet(input.loadSpringer(input.doi));
        if (paper?.paper.length) {
            return {
                ...paper,
                contentNotice:
                    "This Google Scholar result was resolved to its Springer Nature full-text record.",
            };
        }
    }

    return null;
}
