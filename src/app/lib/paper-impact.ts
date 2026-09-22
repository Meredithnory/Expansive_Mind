export type CitationSource = "crossref" | "europepmc" | "scholar";

export type PaperImpact = {
    citationCount?: number;
    citationSource?: CitationSource;
};

export type CitationPopularityLevel =
    | "none"
    | "emerging"
    | "cited"
    | "widely-cited"
    | "highly-cited";

export type CitationPopularity = {
    level: CitationPopularityLevel;
    label: string;
};

const SOURCE_RANK: Record<CitationSource, number> = {
    crossref: 3,
    europepmc: 2,
    scholar: 1,
};

const CITATION_NOTE =
    "Times later papers have referenced this work. Citation count measures attention, not quality or correctness.";

export function normalizePaperDoi(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const doi = value
        .trim()
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
        .replace(/^doi:\s*/i, "")
        .toLowerCase();
    return /^10\.\d{4,9}\/[^\s"\\<>]+$/.test(doi) && doi.length <= 250
        ? doi
        : undefined;
}

export function normalizePmcid(value: unknown): string | undefined {
    if (typeof value !== "string" && typeof value !== "number") {
        return undefined;
    }
    const pmcid = String(value).trim().replace(/^pmc/i, "");
    return /^[1-9]\d{0,11}$/.test(pmcid) ? pmcid : undefined;
}

export function parseCitationCount(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        const count = Math.floor(value);
        return count >= 0 ? count : undefined;
    }
    if (typeof value === "string" && value.trim()) {
        const count = Number.parseInt(value.replace(/,/g, ""), 10);
        return Number.isFinite(count) && count >= 0 ? count : undefined;
    }
    return undefined;
}

export function mergePaperImpact(
    ...impacts: Array<PaperImpact | null | undefined>
): PaperImpact {
    let best: PaperImpact = {};
    for (const impact of impacts) {
        const citationCount = parseCitationCount(impact?.citationCount);
        if (citationCount == null) continue;
        const citationSource = impact?.citationSource;
        const currentRank = best.citationSource
            ? SOURCE_RANK[best.citationSource]
            : 0;
        const nextRank = citationSource ? SOURCE_RANK[citationSource] : 0;
        if (best.citationCount == null || nextRank > currentRank) {
            best = {
                citationCount,
                ...(citationSource ? { citationSource } : {}),
            };
        }
    }
    return best;
}

export function formatCitationCount(count: number): string {
    const formatted = new Intl.NumberFormat("en-US").format(count);
    return count === 1 ? "1 citation" : `${formatted} citations`;
}

export function citationPopularity(count: number): CitationPopularity {
    if (count <= 0) return { level: "none", label: "Not yet cited" };
    if (count < 10) return { level: "emerging", label: "Emerging" };
    if (count < 50) return { level: "cited", label: "Cited" };
    if (count < 200) return { level: "widely-cited", label: "Widely cited" };
    return { level: "highly-cited", label: "Highly cited" };
}

export function citationSourceLabel(source?: CitationSource): string {
    if (source === "crossref") return "Crossref";
    if (source === "europepmc") return "Europe PMC";
    if (source === "scholar") return "Google Scholar";
    return "the source index";
}

export function citationCredibilityNote(source?: CitationSource): string {
    return `${CITATION_NOTE} Count via ${citationSourceLabel(source)}.`;
}
