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

const EMERGING_BELOW = 10;
const CITED_BELOW = 50;
const WIDELY_CITED_BELOW = 200;

export function citationPopularity(count: number): CitationPopularity {
    if (count <= 0) return { level: "none", label: "Not yet cited" };
    if (count < EMERGING_BELOW) return { level: "emerging", label: "Emerging" };
    if (count < CITED_BELOW) return { level: "cited", label: "Cited" };
    if (count < WIDELY_CITED_BELOW) {
        return { level: "widely-cited", label: "Widely cited" };
    }
    return { level: "highly-cited", label: "Highly cited" };
}

/** Why this count received its label. The index supplies the number; we supply the word. */
export function citationRankReason(count: number): string {
    const { label } = citationPopularity(count);
    if (count <= 0) return "Not yet cited means the index reports zero citations.";
    if (count < EMERGING_BELOW) {
        return `${label} means fewer than ${EMERGING_BELOW} citations.`;
    }
    if (count < CITED_BELOW) {
        return `${label} means ${EMERGING_BELOW} to ${CITED_BELOW - 1} citations.`;
    }
    if (count < WIDELY_CITED_BELOW) {
        return `${label} means ${CITED_BELOW} to ${WIDELY_CITED_BELOW - 1} citations.`;
    }
    return `${label} means ${WIDELY_CITED_BELOW} or more citations.`;
}

/** The full scale, so the bands stay next to the thresholds above. */
export function citationRankingGuide(): string {
    return `1–${EMERGING_BELOW - 1} Emerging · ${EMERGING_BELOW}–${CITED_BELOW - 1} Cited · ${CITED_BELOW}–${WIDELY_CITED_BELOW - 1} Widely cited · ${WIDELY_CITED_BELOW}+ Highly cited.`;
}

export function citationSourceLabel(
    source?: CitationSource | null,
): string | null {
    if (source === "crossref") return "Crossref";
    if (source === "europepmc") return "Europe PMC";
    if (source === "scholar") return "Google Scholar";
    return null;
}

/** Short visible label for where the citation count was pulled from. */
export function citationCountSourceLine(
    source?: CitationSource | null,
): string {
    const label = citationSourceLabel(source);
    return label ? `Count via ${label}` : "Count source unknown";
}

export function citationCredibilityNote(
    source?: CitationSource | null,
): string {
    return `${CITATION_NOTE} ${citationCountSourceLine(source)}.`;
}
