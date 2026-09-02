import type {
    OpportunityReport,
    PaperExtraction,
    ProjectSeed,
    ReportConfidence,
    ReportGap,
    ReportProblem,
    VenturePotentialItem,
} from "../api/discover/report-types";
import { parseJsonFromLlm } from "../api/discover/parse-llm-json";
import { parseStoredPaperExtractions } from "./evidence-type";

export const GUEST_DISCOVERY_STORAGE_KEY = "guest-discovery-last-result";
export const GUEST_UPGRADE_PROMPTED_KEY = "guest-discovery-upgrade-prompted";
export const GUEST_UPGRADE_VIEW_MS = 5_000;

const REPORT_CONFIDENCES = new Set<ReportConfidence>([
    "established",
    "suggested",
    "speculative",
]);

export type GuestDiscoveryResult = {
    id: string;
    createdAt: string;
    question: string;
    brief: string;
    papers: unknown[];
    meta?: Record<string, unknown>;
    report?: OpportunityReport;
    extractions?: PaperExtraction[];
};

function asTrimmedString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

function asIndexList(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) =>
            typeof item === "number"
                ? item
                : typeof item === "string"
                  ? Number.parseInt(item, 10)
                  : NaN,
        )
        .filter((item) => Number.isInteger(item) && item >= 1);
}

function asConfidence(value: unknown): ReportConfidence {
    return typeof value === "string" &&
        REPORT_CONFIDENCES.has(value as ReportConfidence)
        ? (value as ReportConfidence)
        : "suggested";
}

function parseGap(value: unknown): ReportGap | null {
    if (!value || typeof value !== "object") return null;
    const gap = value as Record<string, unknown>;
    const title = asTrimmedString(gap.title);
    const description = asTrimmedString(gap.description);
    if (!title && !description) return null;
    return {
        title: title || "Untitled gap",
        description,
        whyItMatters: asTrimmedString(gap.whyItMatters),
        citations: asIndexList(gap.citations),
        confidence: asConfidence(gap.confidence),
    };
}

function parseProblem(value: unknown): ReportProblem | null {
    if (!value || typeof value !== "object") return null;
    const problem = value as Record<string, unknown>;
    const title = asTrimmedString(problem.title);
    const description = asTrimmedString(problem.description);
    if (!title && !description) return null;
    return {
        title: title || "Untitled problem",
        description,
        gapRefs: asIndexList(problem.gapRefs),
    };
}

function parseVenture(value: unknown): VenturePotentialItem | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const title = asTrimmedString(item.title);
    const thesis = asTrimmedString(item.thesis);
    if (!title && !thesis) return null;
    return {
        title: title || "Untitled opportunity",
        thesis,
        feasibilitySignals: asTrimmedString(item.feasibilitySignals),
        risks: asTrimmedString(item.risks),
        citations: asIndexList(item.citations),
    };
}

function parseSeed(value: unknown): ProjectSeed | null {
    if (!value || typeof value !== "object") return null;
    const seed = value as Record<string, unknown>;
    const title = asTrimmedString(seed.title);
    const oneLiner = asTrimmedString(seed.oneLiner);
    if (!title && !oneLiner) return null;
    const gapRefRaw = seed.gapRef;
    const gapRef =
        typeof gapRefRaw === "number"
            ? gapRefRaw
            : typeof gapRefRaw === "string"
              ? Number.parseInt(gapRefRaw, 10)
              : NaN;
    return {
        title: title || "Untitled project",
        oneLiner,
        gapRef: Number.isInteger(gapRef) && gapRef >= 1 ? gapRef : 1,
    };
}

export function parseGuestOpportunityReport(
    value: unknown,
): OpportunityReport | undefined {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed.includes('"sections"') && !trimmed.includes('"stateOfScience"')) {
            return undefined;
        }
        const parsed = parseJsonFromLlm(trimmed);
        return parsed ? parseGuestOpportunityReport(parsed) : undefined;
    }
    if (!value || typeof value !== "object") return undefined;
    const raw = value as Record<string, unknown>;
    const nested =
        raw.sections && typeof raw.sections === "object"
            ? (raw.sections as Record<string, unknown>)
            : raw;

    const stateOfScience = asTrimmedString(nested.stateOfScience);
    const gaps = Array.isArray(nested.gaps)
        ? nested.gaps.map(parseGap).filter((gap): gap is ReportGap =>
              Boolean(gap),
          )
        : [];
    const problems = Array.isArray(nested.problems)
        ? nested.problems
              .map(parseProblem)
              .filter((problem): problem is ReportProblem => Boolean(problem))
        : [];
    const venturePotential = Array.isArray(nested.venturePotential)
        ? nested.venturePotential
              .map(parseVenture)
              .filter((item): item is VenturePotentialItem => Boolean(item))
        : [];
    const couldNotVerify = asStringList(nested.couldNotVerify);
    const projectSeeds = Array.isArray(nested.projectSeeds)
        ? nested.projectSeeds
              .map(parseSeed)
              .filter((seed): seed is ProjectSeed => Boolean(seed))
        : [];

    if (
        !stateOfScience &&
        gaps.length === 0 &&
        problems.length === 0 &&
        venturePotential.length === 0
    ) {
        return undefined;
    }

    return {
        sections: {
            stateOfScience,
            gaps,
            problems,
            venturePotential,
            couldNotVerify,
            projectSeeds,
        },
    };
}

export function parseGuestDiscoveryResult(
    value: unknown,
): GuestDiscoveryResult | null {
    if (!value || typeof value !== "object") return null;
    const result = value as Record<string, unknown>;
    if (typeof result.id !== "string") return null;
    if (typeof result.question !== "string") return null;
    if (typeof result.brief !== "string" || result.brief.trim().length === 0) {
        return null;
    }
    if (!Array.isArray(result.papers)) return null;
    const createdAt =
        typeof result.createdAt === "string"
            ? result.createdAt
            : result.createdAt instanceof Date
              ? result.createdAt.toISOString()
              : "";
    if (!createdAt) return null;
    const report =
        parseGuestOpportunityReport(result.report) ??
        parseGuestOpportunityReport(result.brief);
    const extractions = parseStoredPaperExtractions(result.extractions);
    return {
        id: result.id,
        createdAt,
        question: result.question,
        brief: result.brief,
        papers: result.papers,
        meta:
            result.meta && typeof result.meta === "object"
                ? (result.meta as Record<string, unknown>)
                : undefined,
        ...(report ? { report } : {}),
        ...(extractions ? { extractions } : {}),
    };
}

export function readGuestDiscoveryResult(): GuestDiscoveryResult | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(GUEST_DISCOVERY_STORAGE_KEY);
        if (!raw) return null;
        return parseGuestDiscoveryResult(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function writeGuestDiscoveryResult(result: GuestDiscoveryResult) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(
            GUEST_DISCOVERY_STORAGE_KEY,
            JSON.stringify(result),
        );
    } catch {
        // Ignore private-mode / quota failures; the in-memory result still shows.
    }
}

export function shouldPromptGuestUpgrade({
    elapsedMs,
    analysisWasBelowFold,
    analysisIsVisible,
    viewDelayMs = GUEST_UPGRADE_VIEW_MS,
}: {
    elapsedMs: number;
    analysisWasBelowFold: boolean;
    analysisIsVisible: boolean;
    viewDelayMs?: number;
}) {
    if (elapsedMs >= viewDelayMs) return true;
    return analysisWasBelowFold && analysisIsVisible;
}
