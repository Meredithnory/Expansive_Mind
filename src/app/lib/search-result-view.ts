// What one search result row says: source, year, access, authors, and
// which open action it offers. Kept free of React so it is easy to test.

export type SearchResultSource =
    | "nih"
    | "nature"
    | "scholar"
    | "europepmc"
    | "crossref";

export type SearchResultView = {
    source?: SearchResultSource;
    sourceLabel?: string;
    sourceUrl?: string;
    date?: string;
    authors?: unknown;
    abstract?: unknown;
    contentLabel?: "Abstract" | "Search snippet";
    access?: { canSendToAI?: boolean; canDisplayFullText?: boolean };
};

export const RESULT_SOURCE_COLOR: Record<SearchResultSource, string> = {
    nih: "#0ab1ff",
    nature: "#ff5aa9",
    europepmc: "#22a06b",
    crossref: "#f5a524",
    scholar: "#8b5cf6",
};

const RESULT_SOURCE_NAME: Record<SearchResultSource, string> = {
    nih: "NIH PubMed Central",
    nature: "Springer Nature",
    europepmc: "Europe PMC",
    crossref: "Crossref",
    scholar: "Google Scholar",
};

/**
 * Abstracts arrive as a string, a list of paragraphs, or a parsed XML node
 * ({ p: "…" }, { "#text": "…" }). Flatten any of them to plain text.
 */
export function normalizeAbstract(abstract: unknown): string {
    if (!abstract) return "";
    if (typeof abstract === "string") return abstract;
    const collect = (node: unknown): string[] => {
        if (!node) return [];
        if (typeof node === "string") return [node];
        if (Array.isArray(node)) return node.flatMap(collect);
        if (typeof node === "object") {
            return Object.entries(node)
                // XML attributes (@pub-type) and parser internals (_text) aren't prose.
                .filter(([key]) => !key.startsWith("@") && !key.startsWith("_"))
                .flatMap(([, value]) => collect(value));
        }
        return [];
    };
    return collect(abstract).join(" ").replace(/\s+/g, " ").trim();
}

export function resultSourceKey(paper: SearchResultView): SearchResultSource {
    return paper.source ?? "nih";
}

export function resultSourceName(paper: SearchResultView) {
    return paper.sourceLabel || RESULT_SOURCE_NAME[resultSourceKey(paper)];
}

export function resultYear(date: string | undefined): string | null {
    return date?.match(/\b(?:1[89]|20)\d{2}\b/)?.[0] ?? null;
}

/** "Elsayed, Ahmed · Ayoub, Wadah · +5 more" */
export function shortAuthors(authors: unknown, shown = 2): string | null {
    if (!Array.isArray(authors)) return null;
    const names = authors
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean);
    if (!names.length) return null;
    const head = names.slice(0, shown).join(" · ");
    const rest = names.length - shown;
    return rest > 0 ? `${head} · +${rest} more` : head;
}

/** The chip on the row. Only a license-cleared paper says "Full text + AI". */
export function resultAccess(paper: SearchResultView): {
    label: string;
    full: boolean;
} {
    if (paper.access?.canSendToAI) return { label: "Full text + AI", full: true };
    if (paper.source === "scholar") {
        return { label: "Full text checked on open", full: false };
    }
    if (resultSourceKey(paper) === "nih") {
        return { label: "License checked on open", full: false };
    }
    if (normalizeAbstract(paper.abstract)) {
        return { label: paper.contentLabel || "Abstract", full: false };
    }
    return { label: "Metadata only", full: false };
}

export function resultOpenLabel(paper: SearchResultView) {
    return paper.access?.canSendToAI ? "Open paper chat" : "Open paper";
}

/** The publisher's page, for rows we can't show in full here. */
export function resultSourceLink(paper: SearchResultView): string | null {
    if (!paper.sourceUrl || paper.access?.canDisplayFullText) return null;
    return /^https?:\/\//i.test(paper.sourceUrl) ? paper.sourceUrl : null;
}

/** Exact under 10,000; "1.6M results" above, where the index totals are rough anyway. */
export function resultCountLabel(totalCount: number, shown: number) {
    const count = Math.max(Number.isFinite(totalCount) ? totalCount : 0, shown);
    const number =
        count < 10_000
            ? count.toLocaleString("en-US")
            : new Intl.NumberFormat("en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
              }).format(count);
    return `${number} ${count === 1 ? "result" : "results"}`;
}

/** Guests get a daily search allowance; signed-in plans get a monthly one. */
export function searchesLeftLabel(
    remaining: number | null | undefined,
    plan: string | null | undefined,
): string | null {
    if (typeof remaining !== "number" || !Number.isFinite(remaining)) return null;
    const noun = remaining === 1 ? "search" : "searches";
    return `${remaining} ${noun} left ${plan === "guest" ? "today" : "this month"}`;
}
