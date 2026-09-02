import { FormattedPaper } from "../general-interfaces";
import { getPaperDetails, getSpringerPaperDetails, getScholarPaperDetails } from "./utils";
import {
    getSourceByDatabase,
    PAPER_SOURCES,
    SourceDatabase,
} from "../../lib/paper-sources";

export {
    buildPaperPath,
    getSourceByDatabase,
    getSourceByLabel,
    PAPER_SOURCES,
    resolveSourceFromSearch,
    type PaperSourceConfig,
    type SourceDatabase,
} from "../../lib/paper-sources";

export async function fetchPaperBySource(
    database: SourceDatabase,
    paperId: string,
    idName?: string,
    fallback?: {
        title?: string;
        authors?: string[];
        abstract?: string;
    },
): Promise<FormattedPaper | null> {
    const config = getSourceByDatabase(database);
    if (!config) return null;

    const resolvedIdName = idName || config.defaultIdName;

    if (database === PAPER_SOURCES.nih.database) {
        return getPaperDetails(paperId, config.label, resolvedIdName);
    }

    if (database === PAPER_SOURCES.springer.database) {
        return getSpringerPaperDetails(
            paperId,
            config.label,
            resolvedIdName,
            fallback,
        );
    }

    if (database === PAPER_SOURCES.scholar.database) {
        return getScholarPaperDetails(
            paperId,
            config.label,
            resolvedIdName,
            fallback,
        );
    }

    return null;
}
