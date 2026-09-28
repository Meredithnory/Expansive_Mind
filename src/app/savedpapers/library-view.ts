import type { SerializedProject } from "../lib/project-types";

export type LibraryTab = "syntheses" | "papers" | "projects" | "highlights";

/** Syntheses lead: Discover → shareable brief is the launch wedge. */
export function parseLibraryTab(value: string | string[] | undefined): LibraryTab {
    const tab = Array.isArray(value) ? value[0] : value;
    return tab === "papers" || tab === "projects" || tab === "highlights"
        ? tab
        : "syntheses";
}

export function normalizeLibraryQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when any field contains the (already normalized) query. */
export function matchesLibraryQuery(
    query: string,
    ...fields: Array<string | null | undefined>
): boolean {
    if (!query) return true;
    return fields.some(
        (field) =>
            typeof field === "string" && field.toLowerCase().includes(query),
    );
}

/** Gap titles from a saved discovery's report, in report order. */
export function synthesisGapTitles(report: unknown, limit = 4): string[] {
    if (!report || typeof report !== "object") return [];
    const sections = (report as { sections?: unknown }).sections;
    if (!sections || typeof sections !== "object") return [];
    const gaps = (sections as { gaps?: unknown }).gaps;
    if (!Array.isArray(gaps)) return [];
    return gaps
        .map((gap) =>
            gap && typeof gap === "object" && typeof gap.title === "string"
                ? gap.title.trim()
                : "",
        )
        .filter(Boolean)
        .slice(0, limit);
}

export function projectProgress(project: Pick<SerializedProject, "plan">) {
    return {
        done: project.plan.filter((step) => step.status === "done").length,
        total: project.plan.length,
    };
}

/** The first step that is not done yet, or null when the plan is finished. */
export function nextProjectStep(
    project: Pick<SerializedProject, "plan">,
): string | null {
    const step = project.plan.find((item) => item.status !== "done");
    return step?.title.trim() || null;
}

/** How many plans came from each saved discovery. */
export function plansPerSynthesis(
    projects: Array<Pick<SerializedProject, "sourceDiscoveryID">>,
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const project of projects) {
        if (!project.sourceDiscoveryID) continue;
        counts.set(
            project.sourceDiscoveryID,
            (counts.get(project.sourceDiscoveryID) ?? 0) + 1,
        );
    }
    return counts;
}

type PaperAccess = {
    accessStatus?: "available" | "restricted" | "check";
    canSendToAI?: boolean | null;
    contentLabel?: "Abstract" | "Search snippet";
};

/**
 * What the paper assistant can read, when the library already knows it. NIH papers are
 * checked when opened, so they get no label here rather than a guess.
 */
export function paperAccessLabel(
    paper: PaperAccess,
): "Full text" | "Search snippet" | "Abstract" | null {
    if (paper.contentLabel) return paper.contentLabel;
    if (paper.accessStatus === "available" && paper.canSendToAI === true) {
        return "Full text";
    }
    return null;
}

export function paperOpenLabel(paper: PaperAccess): string {
    if (paper.canSendToAI === false) return "View source";
    if (paper.accessStatus === "check") return "Open paper";
    return "Open paper chat";
}
