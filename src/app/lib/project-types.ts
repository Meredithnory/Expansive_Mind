import type { SourceDatabase } from "./paper-sources";
import type { ReportConfidence } from "../api/discover/report-types";

export const TITLE_MAX = 300;
export const GAP_DESCRIPTION_MAX = 4_000;
export const WHY_IT_MATTERS_MAX = 2_000;
export const NOTES_MAX = 20_000;

export const STEP_STATUSES = ["pending", "in-progress", "done"] as const;
export type ProjectStepStatus = (typeof STEP_STATUSES)[number];

export interface SerializedProjectGap {
    title: string;
    description: string;
    whyItMatters?: string;
    citations: number[];
    confidence?: ReportConfidence;
}

export interface SerializedProjectPaper {
    index: number;
    database: SourceDatabase;
    paperId: string;
    idName: string;
    title: string;
    authors: string[];
    date: string;
    sourceLabel: string;
    sourceUrl: string;
    href: string;
    doi?: string;
}

export interface SerializedProjectStep {
    title: string;
    description: string;
    status: ProjectStepStatus;
    paperRefs: number[];
}

export interface SerializedProjectTried {
    paperIndex: number;
    method: string;
    finding: string;
}

export interface SerializedProjectNextMove {
    title: string;
    model: string;
    comparison: string;
    readout: string;
    paperRefs: number[];
}

export interface SerializedProjectBriefing {
    alreadyTried: SerializedProjectTried[];
    stillOpen: string[];
    nextMove: SerializedProjectNextMove | null;
    couldNotVerify: string[];
}

export interface SerializedProject {
    id: string;
    title: string;
    sourceDiscoveryID: string | null;
    gap: SerializedProjectGap;
    papers: SerializedProjectPaper[];
    plan: SerializedProjectStep[];
    briefing?: SerializedProjectBriefing;
    notes: string;
    createdAt: string;
    updatedAt: string;
}
