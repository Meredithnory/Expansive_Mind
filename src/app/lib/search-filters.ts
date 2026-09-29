// Search filters shared by the results page and /api/search.

export type SourceFilter =
    | "all"
    | "nih"
    | "springer"
    | "scholar"
    | "europe-pmc"
    | "crossref";

export type DateFilter = "any" | "this-year" | "2-years" | "5-years" | "10-years";

export type PublicationDateRange = {
    fromYear: number;
    toYear: number;
};

/** In the order the filter bar and the phone sheet list them. */
export const SOURCE_FILTERS: {
    value: SourceFilter;
    /** Full name, for the phone sheet and the active-filter label. */
    label: string;
    /** Short name, for the desktop chips. */
    chipLabel: string;
    color: string | null;
    pro?: boolean;
}[] = [
    { value: "all", label: "All sources", chipLabel: "All", color: null },
    { value: "nih", label: "NIH PubMed Central", chipLabel: "NIH PMC", color: "#0ab1ff" },
    { value: "springer", label: "Springer Nature", chipLabel: "Springer Nature", color: "#ff5aa9" },
    { value: "europe-pmc", label: "Europe PMC", chipLabel: "Europe PMC", color: "#22a06b" },
    { value: "crossref", label: "Crossref", chipLabel: "Crossref", color: "#f5a524" },
    { value: "scholar", label: "Google Scholar", chipLabel: "Scholar", color: "#8b5cf6", pro: true },
];

export const DATE_FILTERS: { value: DateFilter; label: string }[] = [
    { value: "any", label: "Any time" },
    { value: "this-year", label: "This year" },
    { value: "2-years", label: "Last 2 years" },
    { value: "5-years", label: "Last 5 years" },
    { value: "10-years", label: "Last 10 years" },
];

const YEARS_BACK: Record<Exclude<DateFilter, "any">, number> = {
    "this-year": 0,
    "2-years": 1,
    "5-years": 4,
    "10-years": 9,
};

export function isSourceFilter(value: unknown): value is SourceFilter {
    return SOURCE_FILTERS.some((filter) => filter.value === value);
}

export function isDateFilter(value: unknown): value is DateFilter {
    return DATE_FILTERS.some((filter) => filter.value === value);
}

export function parseSourceFilter(value: string | null | undefined): SourceFilter {
    return isSourceFilter(value) ? value : "all";
}

export function parseDateFilter(value: string | null | undefined): DateFilter {
    return isDateFilter(value) ? value : "any";
}

export function sourceFilterLabel(value: SourceFilter) {
    return SOURCE_FILTERS.find((filter) => filter.value === value)?.label ?? "All sources";
}

export function dateFilterLabel(value: DateFilter) {
    return DATE_FILTERS.find((filter) => filter.value === value)?.label ?? "Any time";
}

/** "Last 5 years" is this calendar year and the four before it. */
export function publicationDateRange(
    date: DateFilter,
    now: Date = new Date(),
): PublicationDateRange | undefined {
    if (date === "any") return undefined;
    const toYear = now.getUTCFullYear();
    return { fromYear: toYear - YEARS_BACK[date], toYear };
}
