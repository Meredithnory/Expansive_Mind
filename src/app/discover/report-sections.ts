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
        title: "Translational potential",
        description:
            "Where a gap could become a therapeutic, diagnostic, biomarker, tool, or platform. Technical analysis of the cited evidence, not investment advice.",
    },
    {
        id: "limits",
        title: "Limits of this analysis",
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

export const CONFIDENCE_GUIDE: Record<
    ReportConfidence,
    { label: string; meaning: string }
> = {
    established: {
        label: "Established",
        meaning: "Two or more papers in this run independently agree.",
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
        "Claims are drawn only from licensed excerpts of the papers listed below. Open any Paper N to see the excerpt and evidence type.",
        "Confidence badges reflect paper agreement in this run, not how sure the model sounds. Established means two or more papers independently agree; speculative means inferred, not shown.",
        "Human evidence outranks animal, in-vitro, and computational work. A single paper or a preclinical-only claim is labeled as such.",
        "Anything this run could not confirm from the excerpts is listed under Limits of this analysis. Read that section before acting.",
    ],
    footer: "Not medical or investment advice. Verify against the full papers before you design an experiment or a company.",
} as const;
