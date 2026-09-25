import type {
    OpportunityReport,
    ReportConfidence,
} from "../api/discover/report-types";

export type ReportSectionId =
    | "state"
    | "gaps"
    | "problems"
    | "experiments"
    | "translation"
    | "limits";

export interface ReportSectionMeta {
    id: ReportSectionId;
    title: string;
    /** One sentence telling the reader what this section is for. */
    description: string;
}

/**
 * Reading order for the opportunity report: what is known, what is missing,
 * what that blocks, what to run next, where it could translate, and what this
 * run could not confirm.
 */
export const REPORT_SECTIONS: ReportSectionMeta[] = [
    {
        id: "state",
        title: "State of the science",
        description:
            "What the cited papers establish, where they agree or conflict, and what remains untested, weighted by strength of evidence.",
    },
    {
        id: "gaps",
        title: "Gaps in the science",
        description:
            "Where the literature is thin, conflicting, or preclinical-only. Confidence reflects how many independent papers reveal each gap.",
    },
    {
        id: "problems",
        title: "Problems these gaps could solve",
        description:
            "Concrete problems implied by the gaps: who is blocked, by what, and what a solution would enable.",
    },
    {
        id: "experiments",
        title: "Next experiments",
        description:
            "Studies a lab could start now. Each names a system, a comparison, and a readout, and maps back to a gap above.",
    },
    {
        id: "translation",
        title: "Translation notes",
        description:
            "Where a gap could become a therapeutic, diagnostic, biomarker, tool, or platform. Technical analysis of the cited evidence, not investment advice.",
    },
    {
        id: "limits",
        title: "What we could not verify",
        description:
            "What this run could not confirm from licensed excerpts. Read these before acting on anything above.",
    },
];

export interface ReportOutlineEntry extends ReportSectionMeta {
    /** Sequential label such as "01"; only present sections are numbered. */
    number: string;
    /** Item count for list sections; undefined for prose sections. */
    count?: number;
}

function sectionCount(
    report: OpportunityReport,
    id: ReportSectionId,
): number | null {
    const { sections } = report;
    switch (id) {
        case "state":
            return sections.stateOfScience.trim() ? -1 : 0;
        case "gaps":
            return sections.gaps.length;
        case "problems":
            return sections.problems.length;
        case "experiments":
            return sections.projectSeeds.length;
        case "translation":
            return sections.venturePotential.length;
        case "limits":
            return sections.couldNotVerify.length;
        default:
            return 0;
    }
}

export function reportOutline(report: OpportunityReport): ReportOutlineEntry[] {
    const entries: ReportOutlineEntry[] = [];
    for (const meta of REPORT_SECTIONS) {
        const count = sectionCount(report, meta.id);
        if (!count) continue;
        entries.push({
            ...meta,
            number: String(entries.length + 1).padStart(2, "0"),
            ...(count > 0 ? { count } : {}),
        });
    }
    return entries;
}

export function reportSectionAnchor(id: ReportSectionId): string {
    return `discover-section-${id}`;
}

export type ReportRoadmapStepKind = "section" | "gap" | "sources";

export interface ReportRoadmapStep {
    key: string;
    /** Element id to scroll to. */
    anchor: string;
    /** Short index label such as "01" or "Gap 1". */
    number: string;
    /** Truncated title taken from the live report, never invented copy. */
    label: string;
    kind: ReportRoadmapStepKind;
}

function truncateRoadmapLabel(text: string, max = 36): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= max) return cleaned;
    const slice = cleaned.slice(0, max - 1);
    const breakAt = slice.lastIndexOf(" ");
    const base = breakAt > 12 ? slice.slice(0, breakAt) : slice;
    return `${base}…`;
}

/**
 * Compact reading path for the opportunity report. Mirrors present outline
 * sections; the gaps section expands into one step per gap so readers can
 * jump to Gap 1, Gap 2, … Sources is appended when the report has body
 * sections.
 */
export function reportRoadmapSteps(
    report: OpportunityReport,
): ReportRoadmapStep[] {
    const outline = reportOutline(report);
    if (outline.length === 0) return [];

    const steps: ReportRoadmapStep[] = [];
    for (const entry of outline) {
        if (entry.id === "gaps" && report.sections.gaps.length > 0) {
            report.sections.gaps.forEach((gap, index) => {
                const gapNumber = index + 1;
                steps.push({
                    key: `gap-${gapNumber}`,
                    anchor: `discover-gap-${gapNumber}`,
                    number: `Gap ${gapNumber}`,
                    label: truncateRoadmapLabel(gap.title),
                    kind: "gap",
                });
            });
            continue;
        }
        steps.push({
            key: entry.id,
            anchor: reportSectionAnchor(entry.id),
            number: entry.number,
            label: truncateRoadmapLabel(entry.title, 28),
            kind: "section",
        });
    }

    steps.push({
        key: "sources",
        anchor: "discover-sources",
        number: String(outline.length + 1).padStart(2, "0"),
        label: truncateRoadmapLabel("Papers cited in this report", 28),
        kind: "sources",
    });

    return steps;
}

export const CONFIDENCE_GUIDE: Record<
    ReportConfidence,
    { label: string; meaning: string }
> = {
    established: {
        label: "In this run",
        meaning:
            "Two or more selected papers agree. This is not a field-wide finding or a documented absence.",
    },
    suggested: {
        label: "Suggested",
        meaning: "One paper or indirect evidence supports it.",
    },
    speculative: {
        label: "Speculative",
        meaning: "Inferred from the evidence rather than shown by it.",
    },
};

/** Shown on every report so readers can judge the work, not the model. */
export const GROUNDING_NOTE = {
    title: "How to read this",
    lead: "This is a literature synthesis, not a model’s opinion. Treat it as a cited brief you can check, not as a finding.",
    points: [
        "Each claim is tied to a passage in a licensed excerpt when one could be checked. A DOI or paper number alone is not support. Machine checking is not human review.",
        "Confidence badges reflect agreement among the papers selected for this run, not a field-wide finding. In this run means two or more selected papers agree; speculative means inferred, not shown.",
        "Human evidence outranks animal, in-vitro, and computational work. A single paper or a preclinical-only claim is labeled as such.",
        "Anything this run could not confirm from the excerpts is listed under What we could not verify. Read that section before acting.",
    ],
    footer: "Not medical or investment advice. Verify against the full papers before you design an experiment or a company.",
} as const;
