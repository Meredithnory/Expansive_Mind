import { FormattedPaper } from "../general-interfaces";
import {
    getSourceByDatabase,
    makePaperLocator,
    SourceDatabase,
} from "../../lib/paper-sources";
import { loadDocument } from "../research/registry";

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

    return loadDocument({
        locator: makePaperLocator(database, paperId, idName),
        fallback,
    });
}
