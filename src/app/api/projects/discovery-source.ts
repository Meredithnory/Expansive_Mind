import type { PaperExtraction } from "../discover/report-types";
import { parseStoredPaperExtractions } from "../../lib/evidence-type";

export function extractionsFromDiscovery(discovery: {
    extractions?: unknown;
    report?: unknown;
}): PaperExtraction[] | undefined {
    const stored = parseStoredPaperExtractions(discovery.extractions);
    if (stored?.length) return stored;

    const report = discovery.report;
    if (!report || typeof report !== "object") return undefined;
    return parseStoredPaperExtractions(
        (report as { extractions?: unknown }).extractions,
    );
}
