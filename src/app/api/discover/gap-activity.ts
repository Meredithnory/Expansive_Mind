// Live "who else is working on this gap" lookups: NIH RePORTER grants and
// active ClinicalTrials.gov studies. Free public APIs, no keys. Failures
// degrade to status "unavailable"; the report always ships.
import {
    ACTIVE_TRIAL_STATUSES,
    buildRegistryQuery,
    formatTrialPhase,
    grantHref,
    recentFiscalYears,
    trialHref,
} from "../../lib/gap-activity";
import type {
    GapActivity,
    GapGrantRef,
    GapRegistryResult,
    GapTrialRef,
    OpportunityReport,
    ReportGap,
} from "./report-types";

const REPORTER_URL = "https://api.reporter.nih.gov/v2/projects/search";
const CLINICAL_TRIALS_URL = "https://clinicaltrials.gov/api/v2/studies";
const FETCH_MS = 8_000;
/** RePORTER asks for no more than one request per second. */
const REPORTER_SPACING_MS = 1_100;
/** Stop starting new lookups after this; remaining gaps ship without activity. */
const TOTAL_BUDGET_MS = 15_000;
const MAX_GAPS = 4;
const MAX_ITEMS = 3;
const GRANT_ROWS = 25;

const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const count = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

const unavailable = <T>(): GapRegistryResult<T> => ({
    status: "unavailable",
    total: 0,
    items: [],
});

export async function searchNihGrants(
    query: string,
    fiscalYears: number[],
): Promise<GapRegistryResult<GapGrantRef>> {
    try {
        const response = await fetch(REPORTER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                criteria: {
                    advanced_text_search: {
                        operator: "advanced",
                        search_field: "projecttitle,abstracttext,terms",
                        search_text: query,
                    },
                    fiscal_years: fiscalYears,
                },
                include_fields: ["ApplId", "CoreProjectNum", "ProjectTitle", "FiscalYear"],
                limit: GRANT_ROWS,
            }),
            signal: AbortSignal.timeout(FETCH_MS),
            cache: "no-store",
        });
        if (!response.ok) return unavailable();
        const data = record(await response.json());
        if (!Array.isArray(data.results)) return unavailable();
        // One row per project-year; show each project once.
        const seen = new Set<string>();
        const items: GapGrantRef[] = [];
        for (const raw of data.results) {
            const row = record(raw);
            const coreProjectNum = text(row.core_project_num);
            const title = text(row.project_title);
            const applId = row.appl_id;
            const fiscalYear = row.fiscal_year;
            if (!coreProjectNum || !title || seen.has(coreProjectNum)) continue;
            if (typeof applId !== "number" || !Number.isInteger(applId)) continue;
            if (typeof fiscalYear !== "number") continue;
            seen.add(coreProjectNum);
            items.push({ coreProjectNum, title, fiscalYear, href: grantHref(applId) });
            if (items.length === MAX_ITEMS) break;
        }
        return {
            status: "ok",
            total: Math.max(count(record(data.meta).total), items.length),
            items,
        };
    } catch {
        return unavailable();
    }
}

export async function searchActiveTrials(
    query: string,
): Promise<GapRegistryResult<GapTrialRef>> {
    try {
        const params = new URLSearchParams({
            "query.term": query,
            "filter.overallStatus": ACTIVE_TRIAL_STATUSES.join(","),
            fields: "NCTId,BriefTitle,OverallStatus,Phase",
            pageSize: String(MAX_ITEMS),
            countTotal: "true",
        });
        const response = await fetch(`${CLINICAL_TRIALS_URL}?${params}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(FETCH_MS),
            cache: "no-store",
        });
        if (!response.ok) return unavailable();
        const data = record(await response.json());
        if (!Array.isArray(data.studies)) return unavailable();
        const items = data.studies.flatMap((raw): GapTrialRef[] => {
            const section = record(record(raw).protocolSection);
            const nctId = text(record(section.identificationModule).nctId);
            const title = text(record(section.identificationModule).briefTitle);
            const status = text(record(section.statusModule).overallStatus);
            if (!/^NCT\d{8}$/.test(nctId) || !title || !status) return [];
            const phase = formatTrialPhase(record(section.designModule).phases);
            return [{ nctId, title, status, ...(phase ? { phase } : {}), href: trialHref(nctId) }];
        });
        return {
            status: "ok",
            total: Math.max(count(data.totalCount), items.length),
            items: items.slice(0, MAX_ITEMS),
        };
    } catch {
        return unavailable();
    }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function withoutActivity(gap: ReportGap): ReportGap {
    const clean = { ...gap };
    delete clean.activity;
    return clean;
}

export interface GapActivityOptions {
    now?: Date;
    wait?: (ms: number) => Promise<void>;
    clock?: () => number;
}

/**
 * Replaces every gap's activity with live registry results. Model output can
 * never supply activity: it is stripped first. Never throws.
 */
export async function attachGapActivity(
    report: OpportunityReport,
    options: GapActivityOptions = {},
): Promise<OpportunityReport> {
    const now = options.now ?? new Date();
    const wait = options.wait ?? delay;
    const clock = options.clock ?? Date.now;
    const fiscalYears = recentFiscalYears(now);
    const started = clock();
    const gaps = report.sections.gaps.map(withoutActivity);

    const lookups = gaps.map((gap, index) =>
        index < MAX_GAPS && gap.registryTerms?.length
            ? buildRegistryQuery(gap.registryTerms)
            : "",
    );

    const trials = Promise.all(
        lookups.map((query) => (query ? searchActiveTrials(query) : null)),
    );

    const grants: Array<GapRegistryResult<GapGrantRef> | null> = [];
    let reporterCalls = 0;
    for (const query of lookups) {
        if (!query || clock() - started > TOTAL_BUDGET_MS) {
            grants.push(null);
            continue;
        }
        if (reporterCalls > 0) await wait(REPORTER_SPACING_MS);
        reporterCalls += 1;
        grants.push(await searchNihGrants(query, fiscalYears));
    }

    const trialResults = await trials;
    const checkedAt = now.toISOString();
    return {
        ...report,
        sections: {
            ...report.sections,
            gaps: gaps.map((gap, index) => {
                const query = lookups[index];
                const grantResult = grants[index];
                const trialResult = trialResults[index];
                if (!query || !grantResult || !trialResult) return gap;
                const activity: GapActivity = {
                    checkedAt,
                    query,
                    fiscalYears,
                    grants: grantResult,
                    trials: trialResult,
                };
                return { ...gap, activity };
            }),
        },
    };
}
