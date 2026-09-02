import type {
    SerializedProject,
    SerializedProjectBriefing,
    SerializedProjectGap,
    SerializedProjectPaper,
    SerializedProjectStep,
} from "../../lib/project-types";

export {
    GAP_DESCRIPTION_MAX,
    NOTES_MAX,
    STEP_STATUSES,
    TITLE_MAX,
    WHY_IT_MATTERS_MAX,
    type ProjectStepStatus,
    type SerializedProject,
    type SerializedProjectGap,
    type SerializedProjectPaper,
    type SerializedProjectStep,
} from "../../lib/project-types";

function asIso(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return "";
}

function serializeBriefing(
    briefing?: SerializedProjectBriefing,
): SerializedProjectBriefing | undefined {
    if (!briefing) return undefined;
    return {
        alreadyTried: (briefing.alreadyTried ?? []).map((item) => ({
            paperIndex: item.paperIndex,
            method: item.method ?? "",
            finding: item.finding ?? "",
        })),
        stillOpen: [...(briefing.stillOpen ?? [])],
        nextMove: briefing.nextMove
            ? {
                  title: briefing.nextMove.title ?? "",
                  model: briefing.nextMove.model ?? "",
                  comparison: briefing.nextMove.comparison ?? "",
                  readout: briefing.nextMove.readout ?? "",
                  paperRefs: [...(briefing.nextMove.paperRefs ?? [])],
              }
            : null,
        couldNotVerify: [...(briefing.couldNotVerify ?? [])],
    };
}

export function serializeProject(doc: {
    _id: { toString(): string };
    title: string;
    sourceDiscoveryID?: { toString(): string } | null;
    gap: SerializedProjectGap;
    papers: SerializedProjectPaper[];
    plan: SerializedProjectStep[];
    briefing?: SerializedProjectBriefing;
    notes?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}): SerializedProject {
    return {
        id: doc._id.toString(),
        title: doc.title,
        sourceDiscoveryID: doc.sourceDiscoveryID
            ? doc.sourceDiscoveryID.toString()
            : null,
        gap: {
            title: doc.gap.title,
            description: doc.gap.description,
            ...(doc.gap.whyItMatters ? { whyItMatters: doc.gap.whyItMatters } : {}),
            citations: Array.isArray(doc.gap.citations) ? doc.gap.citations : [],
            ...(doc.gap.confidence ? { confidence: doc.gap.confidence } : {}),
        },
        papers: doc.papers ?? [],
        plan: doc.plan ?? [],
        ...(serializeBriefing(doc.briefing)
            ? { briefing: serializeBriefing(doc.briefing) }
            : {}),
        notes: doc.notes ?? "",
        createdAt: asIso(doc.createdAt),
        updatedAt: asIso(doc.updatedAt),
    };
}
