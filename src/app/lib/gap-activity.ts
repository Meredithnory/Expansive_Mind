// Pure helpers for gap activity (NIH grants + active trials). Client-safe:
// guest discoveries parse stored reports in the browser. Fetching lives in
// src/app/api/discover/gap-activity.ts.
import type {
    GapActivity,
    GapGrantRef,
    GapRegistryResult,
    GapTrialRef,
} from "../api/discover/report-types";

const MAX_GROUPS = 3;
const MAX_CONCEPTS = 3;
const MAX_CONCEPT_LENGTH = 40;
const MAX_CONCEPT_WORDS = 3;
const MIN_CONCEPTS = 2;
/** Above these totals a list of examples is noise, not related work. */
export const BROAD_MATCH_GRANTS = 300;
export const BROAD_MATCH_TRIALS = 100;
/** Words that match most of a registry on their own. */
const GENERIC_CONCEPTS = new Set([
    "safety", "efficacy", "long term", "long-term", "mechanism", "mechanisms",
    "cell type", "cell types", "human", "humans", "patient", "patients",
    "treatment", "treatments", "therapy", "therapies", "disease", "diseases",
    "outcome", "outcomes", "study", "studies", "research", "clinical", "trial",
    "trials", "biomarker", "biomarkers", "response", "responses", "effect",
    "effects", "role", "risk", "data", "model", "models", "mice", "mouse",
]);
const MAX_ITEMS = 3;
const REPORTER_PROJECT = /^https:\/\/reporter\.nih\.gov\/project-details\/\d{1,12}$/;
const NCT_ID = /^NCT\d{8}$/;

const text = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

/** Letters, digits, spaces, hyphens, apostrophes. Quotes and operators never reach a registry. */
function sanitizeConcept(value: unknown): string {
    const cleaned = text(value)
        .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    if (cleaned.length < 2 || cleaned.length > MAX_CONCEPT_LENGTH) return "";
    // Registries match exact phrases; long phrases silently miss real work.
    if (cleaned.split(" ").length > MAX_CONCEPT_WORDS) return "";
    if (/^(and|or|not)$/.test(cleaned) || GENERIC_CONCEPTS.has(cleaned)) return "";
    return cleaned;
}

export function sanitizeRegistryTerms(value: unknown): string[][] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const groups: string[][] = [];
    for (const rawGroup of value) {
        const concepts = (Array.isArray(rawGroup) ? rawGroup : [rawGroup])
            .map(sanitizeConcept)
            .filter(Boolean);
        const group = [...new Set(concepts)].slice(0, MAX_CONCEPTS);
        const key = [...group].sort().join("|");
        // A lone concept (e.g. "alzheimer") matches thousands of unrelated records.
        if (group.length < MIN_CONCEPTS || seen.has(key)) continue;
        seen.add(key);
        groups.push(group);
        if (groups.length === MAX_GROUPS) break;
    }
    return groups;
}

/** `("a" AND "b") OR ("c")` — the same syntax works for RePORTER and ClinicalTrials.gov. */
export function buildRegistryQuery(groups: string[][]): string {
    return groups
        .map((group) => `(${group.map((concept) => `"${concept}"`).join(" AND ")})`)
        .join(" OR ");
}

/** NIH fiscal year starts October 1. */
export function nihFiscalYear(now: Date): number {
    return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

export function recentFiscalYears(now: Date): number[] {
    const current = nihFiscalYear(now);
    return [current - 2, current - 1, current];
}

export const grantHref = (applId: number | string): string =>
    `https://reporter.nih.gov/project-details/${applId}`;

export const trialHref = (nctId: string): string =>
    `https://clinicaltrials.gov/study/${nctId}`;

const TRIAL_STATUS_LABELS: Record<string, string> = {
    RECRUITING: "Recruiting",
    NOT_YET_RECRUITING: "Not yet recruiting",
    ACTIVE_NOT_RECRUITING: "Active, not recruiting",
    ENROLLING_BY_INVITATION: "Enrolling by invitation",
};

export const ACTIVE_TRIAL_STATUSES = Object.keys(TRIAL_STATUS_LABELS);

export function trialStatusLabel(status: string): string {
    return TRIAL_STATUS_LABELS[status] ?? status;
}

/** ["PHASE1","PHASE2"] → "Phase 1/2". "NA" and unknown values drop out. */
export function formatTrialPhase(phases: unknown): string | undefined {
    if (!Array.isArray(phases)) return undefined;
    const numbers = phases
        .map((phase) => text(phase).match(/^(EARLY_)?PHASE(\d)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => (match[1] ? `early ${match[2]}` : match[2]));
    return numbers.length > 0 ? `Phase ${numbers.join("/")}` : undefined;
}

function parseResult<T>(
    value: unknown,
    parseItem: (item: unknown) => T | null,
): GapRegistryResult<T> {
    const result =
        value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const status = result.status === "ok" ? "ok" : "unavailable";
    const total =
        typeof result.total === "number" && Number.isInteger(result.total) && result.total >= 0
            ? result.total
            : 0;
    const items = Array.isArray(result.items)
        ? result.items
              .map(parseItem)
              .filter((item): item is T => item !== null)
              .slice(0, MAX_ITEMS)
        : [];
    return status === "ok"
        ? { status, total: Math.max(total, items.length), items }
        : { status, total: 0, items: [] };
}

function parseGrant(value: unknown): GapGrantRef | null {
    if (!value || typeof value !== "object") return null;
    const grant = value as Record<string, unknown>;
    const title = text(grant.title);
    const coreProjectNum = text(grant.coreProjectNum);
    const href = text(grant.href);
    const fiscalYear = grant.fiscalYear;
    if (!title || !coreProjectNum || !REPORTER_PROJECT.test(href)) return null;
    if (typeof fiscalYear !== "number" || !Number.isInteger(fiscalYear)) return null;
    return { coreProjectNum, title, fiscalYear, href };
}

function parseTrial(value: unknown): GapTrialRef | null {
    if (!value || typeof value !== "object") return null;
    const trial = value as Record<string, unknown>;
    const nctId = text(trial.nctId);
    const title = text(trial.title);
    const status = text(trial.status);
    if (!NCT_ID.test(nctId) || !title || !status) return null;
    const phase = text(trial.phase);
    return {
        nctId,
        title,
        status,
        ...(phase ? { phase } : {}),
        href: trialHref(nctId),
    };
}

/** Stored activity is re-validated; links are rebuilt or pattern-checked, never trusted. */
export function parseGapActivity(value: unknown): GapActivity | undefined {
    if (!value || typeof value !== "object") return undefined;
    const activity = value as Record<string, unknown>;
    const checkedAt = text(activity.checkedAt);
    const query = text(activity.query);
    if (!checkedAt || Number.isNaN(Date.parse(checkedAt)) || !query) return undefined;
    const fiscalYears = Array.isArray(activity.fiscalYears)
        ? activity.fiscalYears.filter(
              (year): year is number => typeof year === "number" && Number.isInteger(year),
          )
        : [];
    return {
        checkedAt,
        query,
        fiscalYears,
        grants: parseResult(activity.grants, parseGrant),
        trials: parseResult(activity.trials, parseTrial),
    };
}

/** Optional gap fields shared by the server and guest report parsers. */
export function parseGapRegistryFields(gap: Record<string, unknown>): {
    registryTerms?: string[][];
    activity?: GapActivity;
} {
    const registryTerms = sanitizeRegistryTerms(gap.registryTerms);
    const activity = parseGapActivity(gap.activity);
    return {
        ...(registryTerms.length > 0 ? { registryTerms } : {}),
        ...(activity ? { activity } : {}),
    };
}

export function fiscalYearRangeLabel(fiscalYears: number[]): string {
    if (fiscalYears.length === 0) return "";
    const first = Math.min(...fiscalYears);
    const last = Math.max(...fiscalYears);
    return first === last ? `FY${first}` : `FY${first}–${String(last).slice(-2)}`;
}
