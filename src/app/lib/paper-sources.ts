export type SourceDatabase = "nih" | "springer" | "scholar";

export interface PaperSourceConfig {
    database: SourceDatabase;
    label: string;
    defaultIdName: string;
}

/** Reader route / cache / SavedDiscovery identity. Does not grow with catalogs. */
export interface PaperLocator {
    database: SourceDatabase;
    paperId: string;
    idName: string;
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

export function isSourceDatabase(
    database: string | undefined | null,
): database is SourceDatabase {
    return (
        database === "nih" ||
        database === "springer" ||
        database === "scholar"
    );
}

export function getSourceByDatabase(
    database: string,
): PaperSourceConfig | undefined {
    return isSourceDatabase(database) ? PAPER_SOURCES[database] : undefined;
}

export function makePaperLocator(
    database: SourceDatabase,
    paperId: string,
    idName?: string,
): PaperLocator {
    return {
        database,
        paperId,
        idName: idName || PAPER_SOURCES[database].defaultIdName,
    };
}

export function searchSourceTag(
    database: SourceDatabase,
): "nih" | "nature" | "scholar" {
    if (database === "nih") return "nih";
    if (database === "scholar") return "scholar";
    return "nature";
}

export function locatorFromLoadedPaper(
    paper: {
        source?: string;
        paperId?: string;
        idName?: string;
    },
    requested: PaperLocator,
): PaperLocator {
    const database = isSourceDatabase(paper.source)
        ? paper.source
        : requested.database;
    return makePaperLocator(
        database,
        paper.paperId || requested.paperId,
        paper.idName ||
            (database === requested.database ? requested.idName : undefined),
    );
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

/** Marks a reader link as opened from a Discover report, so the reader can
 * offer the way back ("Your report · Gap 1 › Paper 3"). */
export const REPORT_VIEWS = ["state", "gaps", "papers", "ledger", "opportunity"] as const;
export type ReportViewId = (typeof REPORT_VIEWS)[number];

/** The report a reader link came from, so "Your report" can reopen it. */
export type ReportReturn = { report?: string | null; view?: string | null };

/** A saved discovery's id (Mongo ObjectId); guest reports have none. */
export function parseSavedReportId(value: string | null | undefined) {
    return value && /^[a-f0-9]{24}$/i.test(value) ? value : null;
}

export function parseReportView(value: string | null | undefined): ReportViewId | null {
    return REPORT_VIEWS.find((view) => view === value) ?? null;
}

export function withReportOrigin(
    href: string,
    paperIndex?: number | null,
    gapNumber?: number | null,
    returnTo?: ReportReturn,
) {
    if (!href.startsWith("/paperchatbot/")) return href;
    const [path, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    params.set("from", "report");
    if (paperIndex && Number.isInteger(paperIndex) && paperIndex > 0) {
        params.set("paper", String(paperIndex));
    }
    if (gapNumber && Number.isInteger(gapNumber) && gapNumber > 0) {
        params.set("gap", String(gapNumber));
    }
    const report = parseSavedReportId(returnTo?.report);
    if (report) params.set("report", report);
    const view = parseReportView(returnTo?.view);
    if (view) params.set("view", view);
    return `${path}?${params}`;
}

/**
 * Where the reader's "Your report" goes: the saved report (a guest's comes
 * back from this browser) on the tab, gap, or paper it was opened from.
 */
export function reportReturnHref({
    report,
    view,
    gap,
    paper,
}: {
    report?: string | null;
    view?: ReportViewId | null;
    gap?: number | null;
    paper?: number | null;
}) {
    const params = new URLSearchParams();
    if (report) params.set("saved", report);
    if (view) params.set("view", view);
    if (gap && view === "gaps") params.set("gap", String(gap));
    if (paper && view === "papers") params.set("paper", String(paper));
    const query = params.toString();
    return query ? `/discover?${query}` : "/discover";
}

/** A report paper or gap number from a reader URL param, if valid. */
export function parseReportPaperNumber(value: string | null | undefined) {
    if (!value || !/^\d{1,3}$/.test(value)) return null;
    const number = Number(value);
    return number > 0 ? number : null;
}

export const PAPER_FOCUS_MAX_CHARS = 240;

export function buildPaperFocusHref(
    href: string,
    excerpt?: string | null,
    { method = true }: { method?: boolean } = {},
) {
    if (!href.startsWith("/paperchatbot/")) return href;
    const [path, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    const snippet = (excerpt || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, PAPER_FOCUS_MAX_CHARS);
    if (snippet) params.set("focus", snippet);
    if (method) params.set("intent", "method");
    const search = params.toString();
    return search ? `${path}?${search}` : path;
}
