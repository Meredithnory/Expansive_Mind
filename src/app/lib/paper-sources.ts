export type SourceDatabase = "nih" | "springer" | "scholar";

export interface PaperSourceConfig {
    database: SourceDatabase;
    label: string;
    defaultIdName: string;
}

export const PAPER_SOURCES: Record<SourceDatabase, PaperSourceConfig> = {
    nih: {
        database: "nih",
        label: "NIH PubMed Central",
        defaultIdName: "pmcid",
    },
    springer: {
        database: "springer",
        label: "Springer Nature",
        defaultIdName: "doi",
    },
    scholar: {
        database: "scholar",
        label: "Google Scholar",
        defaultIdName: "cluster_id",
    },
};

export function getSourceByDatabase(
    database: string,
): PaperSourceConfig | undefined {
    return PAPER_SOURCES[database as SourceDatabase];
}

export function getSourceByLabel(label: string): PaperSourceConfig | undefined {
    return Object.values(PAPER_SOURCES).find((source) => source.label === label);
}

export function resolveSourceFromSearch(
    source?: "nih" | "nature" | "scholar",
): PaperSourceConfig {
    if (source === "nature") return PAPER_SOURCES.springer;
    if (source === "scholar") return PAPER_SOURCES.scholar;
    return PAPER_SOURCES.nih;
}

export function normalizeStoredPaperId(paperId: string): string {
    const trimmed = paperId.trim();
    // PMC IDs may arrive as "PMC1234567" or with stray punctuation.
    // Only strip non-digits for PMC-shaped values — DOIs and other IDs must
    // keep their punctuation (e.g. "10.1186/s41073-026-00245-8").
    if (/^PMC/i.test(trimmed)) {
        return trimmed.replace(/^PMC/i, "").replace(/\D/g, "") || trimmed;
    }
    return trimmed;
}

export function buildPaperPath(
    database: SourceDatabase,
    paperId: string,
    idName?: string,
): string {
    const config = PAPER_SOURCES[database];
    const encodedId = paperId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    const params = new URLSearchParams();
    const resolvedIdName = idName || config.defaultIdName;
    if (resolvedIdName !== config.defaultIdName) {
        params.set("idName", resolvedIdName);
    }
    const query = params.toString();
    return query
        ? `/paperchatbot/${database}/${encodedId}?${query}`
        : `/paperchatbot/${database}/${encodedId}`;
}

export const PAPER_FOCUS_MAX_CHARS = 240;

export function buildPaperFocusHref(
    href: string,
    excerpt?: string | null,
) {
    if (!href.startsWith("/paperchatbot/")) return href;
    const [path, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    const snippet = (excerpt || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, PAPER_FOCUS_MAX_CHARS);
    if (snippet) params.set("focus", snippet);
    params.set("intent", "method");
    const search = params.toString();
    return search ? `${path}?${search}` : path;
}
