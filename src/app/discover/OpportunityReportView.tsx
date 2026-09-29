"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import styles from "./discover.module.scss";
import GapActivityView from "./GapActivityView";
import { gapActivitySummary } from "../lib/gap-activity";
import type {
    DiscoverPaperCard,
    OpportunityReport,
    ProjectSeed,
    ReportConfidence,
    ReportGap,
    PaperEvidence,
} from "../api/discover/report-types";
import { withReportOrigin } from "../lib/paper-sources";
import {
    evidenceFocusHref,
    gapEvidenceId,
    type CiteContext,
} from "../lib/paper-evidence";
import { useSession } from "../lib/use-session";
import { splitCitedText, splitParagraphs } from "./report-text";
import {
    CONFIDENCE_GUIDE,
    reportOutline,
    reportSectionAnchor,
    type ReportOutlineEntry,
    type ReportSectionId,
} from "./report-sections";

type ProjectGapPayload = {
    title: string;
    description: string;
    whyItMatters?: string;
    citations: number[];
    confidence?: ReportConfidence;
};

type ProjectActionState = {
    key: string | null;
    status: "idle" | "loading" | "success" | "error";
    projectId?: string;
    error?: string;
    errorStatus?: number;
};

function gapPayload(gap: ReportGap): ProjectGapPayload {
    return {
        title: gap.title,
        description: gap.description,
        ...(gap.whyItMatters ? { whyItMatters: gap.whyItMatters } : {}),
        citations: gap.citations,
        ...(gap.confidence ? { confidence: gap.confidence } : {}),
    };
}

function resolveSeedGap(seed: ProjectSeed, gaps: ReportGap[]): ReportGap {
    const resolved = gaps[seed.gapRef - 1];
    if (resolved) return resolved;
    return {
        title: seed.title,
        description: seed.oneLiner,
        whyItMatters: "",
        citations: [],
        confidence: "suggested",
    };
}

type CitePaper = (
    index: number,
    trigger?: HTMLElement | null,
    cite?: CiteContext,
) => void;

function CitedText({
    text,
    paperCount,
    activePaperIndex,
    onCite,
    refs,
}: {
    text: string;
    paperCount: number;
    activePaperIndex?: number | null;
    onCite: CitePaper;
    /** The evidence id each chip cites, in chip order (report.sections.citationEvidence). */
    refs?: Array<string | null>;
}) {
    const segments = splitCitedText(text, paperCount);
    let chip = -1;
    // The claim a chip backs: the words since the sentence start or the last
    // chip. Chips in one group ("[Papers 1, 6]") share it.
    let claim = "";
    return (
        <>
            {segments.map((segment, index) => {
                if (segment.type === "text") {
                    if (segment.value.trim().length > 2) {
                        claim = segment.value.split(/(?<=[.!?])\s+/).pop() ?? "";
                    }
                    return (
                        <React.Fragment key={`text-${index}`}>
                            {segment.value}
                        </React.Fragment>
                    );
                }
                chip += 1;
                const cite: CiteContext = {
                    evidenceId: refs?.[chip] ?? null,
                    context: claim,
                };
                return (
                    <button
                        key={`cite-${index}-${segment.index}`}
                        type="button"
                        className={clsx(styles.citationChip, {
                            [styles.citationChipActive]:
                                activePaperIndex === segment.index,
                        })}
                        aria-haspopup="dialog"
                        aria-expanded={activePaperIndex === segment.index}
                        aria-pressed={activePaperIndex === segment.index}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onCite(segment.index, event.currentTarget, cite);
                        }}
                    >
                        {segment.label}
                    </button>
                );
            })}
        </>
    );
}

function CitationChips({
    citations,
    paperCount,
    activePaperIndex,
    onCite,
}: {
    citations: number[];
    paperCount: number;
    activePaperIndex?: number | null;
    onCite: CitePaper;
}) {
    const valid = citations.filter(
        (index) => index >= 1 && index <= paperCount,
    );
    if (valid.length === 0) return null;
    return (
        <div className={styles.citationRow}>
            {valid.map((index) => (
                <button
                    key={index}
                    type="button"
                    className={clsx(styles.citationChip, {
                        [styles.citationChipActive]:
                            activePaperIndex === index,
                    })}
                    aria-haspopup="dialog"
                    aria-expanded={activePaperIndex === index}
                    aria-pressed={activePaperIndex === index}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onCite(index, event.currentTarget);
                    }}
                >
                    {`Paper ${index}`}
                </button>
            ))}
        </div>
    );
}

function ConfidenceBadge({ value }: { value: ReportConfidence }) {
    const guide = CONFIDENCE_GUIDE[value] ?? CONFIDENCE_GUIDE.suggested;
    return (
        <span
            className={clsx(styles.confidenceBadge, {
                [styles.confidenceEstablished]: value === "established",
                [styles.confidenceSuggested]: value === "suggested",
                [styles.confidenceSpeculative]: value === "speculative",
            })}
            title={guide.meaning}
        >
            {guide.label}
        </span>
    );
}

function SectionHead({
    entry,
    countLabel,
}: {
    entry: ReportOutlineEntry;
    countLabel?: string;
}) {
    return (
        <header className={styles.sectionHead}>
            <div className={styles.sectionHeadMain}>
                <span className={styles.sectionNumber}>{entry.number}</span>
                <div>
                    <h3 className={styles.sectionHeadTitle}>{entry.title}</h3>
                    <p className={styles.sectionHeadDescription}>
                        {entry.description}
                    </p>
                </div>
            </div>
            {countLabel ? (
                <span className={styles.sectionHeadCount}>{countLabel}</span>
            ) : null}
        </header>
    );
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function isAbortError(error: unknown) {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
    );
}

function StartProjectButton({
    actionKey,
    action,
    onClick,
    onCancel,
    onDiscard,
    discarding,
}: {
    actionKey: string;
    action: ProjectActionState;
    onClick: () => void;
    onCancel: () => void;
    onDiscard: () => void;
    discarding: boolean;
}) {
    const isLoading =
        action.status === "loading" && action.key === actionKey;
    const isSuccess =
        action.status === "success" && action.key === actionKey;
    const isAnyProjectLoading = action.status === "loading";
    return (
        <div
            className={clsx(styles.projectAction, {
                [styles.projectActionLoading]: isLoading,
            })}
            aria-live="polite"
        >
            <button
                type="button"
                className={clsx(styles.startProject, {
                    [styles.startProjectLoading]: isLoading,
                })}
                onClick={onClick}
                disabled={isAnyProjectLoading}
                aria-busy={isLoading}
            >
                {isLoading ? (
                    <>
                        <span
                            className={styles.projectSpinner}
                            aria-hidden="true"
                        />
                        <span>Creating project…</span>
                    </>
                ) : (
                    <>
                        <span>Start a project</span>
                        <span aria-hidden="true">→</span>
                    </>
                )}
            </button>
            {isLoading && (
                <div className={styles.projectLoadingRow}>
                    <p className={styles.projectLoadingMessage} role="status">
                        Setting up your workspace and research plan. This usually
                        takes a few seconds.
                    </p>
                    <button
                        type="button"
                        className={styles.cancelAction}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            )}
            {isSuccess && action.projectId && (
                <p className={styles.projectConfirm}>
                    Project created.{" "}
                    <Link href={`/projects/${action.projectId}`}>
                        Open project
                    </Link>
                    <button
                        type="button"
                        className={styles.discardAction}
                        onClick={onDiscard}
                        disabled={discarding}
                    >
                        {discarding ? "Discarding…" : "Discard"}
                    </button>
                </p>
            )}
        </div>
    );
}

export default function OpportunityReportView({
    report,
    paperCount,
    papers = [],
    only,
    isLoggedIn,
    sourceDiscoveryId,
    activePaperIndex,
    onCitePaper,
    onGuestUpgrade,
    reportView,
    initialGap = null,
    evidenceFor,
}: {
    report: OpportunityReport;
    paperCount: number;
    /** The report's papers, so a gap can open its first paper in the reader. */
    papers?: DiscoverPaperCard[];
    /** Render only these sections (one report tab). All when omitted. */
    only?: ReportSectionId[];
    isLoggedIn: boolean;
    sourceDiscoveryId: string | undefined;
    activePaperIndex?: number | null;
    onCitePaper: CitePaper;
    onGuestUpgrade: () => void;
    /** The report tab showing this view, for the reader's "Your report" link. */
    reportView?: string;
    /** Back from the reader: the gap it was opened from (1-based). */
    initialGap?: number | null;
    /** The evidence a paper citation points to, for reader links. */
    evidenceFor?: (paperIndex: number, cite: CiteContext) => PaperEvidence | null;
}) {
    const { sections } = report;
    const refsFor = (key: string) => sections.citationEvidence?.[key];
    const { refresh } = useSession();
    const [highlightedGap, setHighlightedGap] = useState<number | null>(null);
    // The gap shown large on the gap board (1-based).
    const [selectedGap, setSelectedGap] = useState(() =>
        initialGap && initialGap <= sections.gaps.length ? initialGap : 1,
    );
    const returnScrolledRef = useRef(false);
    const [action, setAction] = useState<ProjectActionState>({
        key: null,
        status: "idle",
    });
    const projectAbortRef = useRef<AbortController | null>(null);
    const projectCancelledRef = useRef(false);
    const [discarding, setDiscarding] = useState(false);

    useEffect(() => {
        if (highlightedGap === null) return;
        const timer = window.setTimeout(() => setHighlightedGap(null), 2_200);
        return () => window.clearTimeout(timer);
    }, [highlightedGap]);

    // Back from the reader: bring the gap it was opened from into view.
    useEffect(() => {
        if (returnScrolledRef.current || !initialGap || !only?.includes("gaps")) return;
        returnScrolledRef.current = true;
        window.requestAnimationFrame(() => {
            document
                .getElementById("discover-gap-focus")
                ?.scrollIntoView({ block: "center" });
        });
    }, [initialGap, only]);

    const scrollToGap = useCallback((gapIndex: number) => {
        setSelectedGap(gapIndex);
        setHighlightedGap(gapIndex);
        window.requestAnimationFrame(() => {
            document
                .getElementById("discover-gap-focus")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }, []);

    const startProject = useCallback(
        async (key: string, title: string, gap: ReportGap) => {
            if (!isLoggedIn) {
                onGuestUpgrade();
                return;
            }
            projectCancelledRef.current = false;
            projectAbortRef.current?.abort();
            const controller = new AbortController();
            projectAbortRef.current = controller;
            setAction({ key, status: "loading" });
            try {
                const response = await fetch("/api/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({
                        title,
                        sourceDiscoveryId,
                        gap: gapPayload(gap),
                    }),
                });
                const data = await response.json().catch(() => ({}));
                const project = data.project as
                    | { id?: unknown; _id?: unknown }
                    | undefined;
                const createdId =
                    typeof project?.id === "string"
                        ? project.id
                        : typeof project?._id === "string"
                          ? project._id
                          : "";
                if (projectCancelledRef.current) {
                    if (createdId) {
                        await fetch(`/api/projects/${createdId}`, {
                            method: "DELETE",
                        }).catch(() => undefined);
                    }
                    setAction({ key: null, status: "idle" });
                    return;
                }
                void refresh();
                if (!response.ok) {
                    const fallback =
                        response.status === 401
                            ? "Sign in to start a project."
                            : response.status === 403
                              ? "You don't have access to start a project."
                              : response.status === 429
                                ? "Project limit reached. Upgrade your plan to continue."
                                : "Unable to start this project.";
                    throw Object.assign(
                        new Error(
                            typeof data.error === "string"
                                ? data.error
                                : fallback,
                        ),
                        { status: response.status },
                    );
                }
                if (!createdId) {
                    throw Object.assign(
                        new Error("Unable to start this project."),
                        { status: response.status },
                    );
                }
                setAction({ key, status: "success", projectId: createdId });
            } catch (err) {
                if (projectCancelledRef.current || isAbortError(err)) {
                    setAction({ key: null, status: "idle" });
                    return;
                }
                const errorStatus =
                    err instanceof Error &&
                    "status" in err &&
                    typeof (err as { status: unknown }).status === "number"
                        ? (err as { status: number }).status
                        : 0;
                setAction({
                    key,
                    status: "error",
                    error:
                        err instanceof Error
                            ? err.message
                            : "Unable to start this project.",
                    errorStatus,
                });
            } finally {
                if (projectAbortRef.current === controller) {
                    projectAbortRef.current = null;
                }
            }
        },
        [isLoggedIn, onGuestUpgrade, refresh, sourceDiscoveryId],
    );

    const cancelProject = useCallback(() => {
        if (action.status !== "loading") return;
        projectCancelledRef.current = true;
        projectAbortRef.current?.abort();
        setAction({ key: null, status: "idle" });
    }, [action.status]);

    const discardProject = useCallback(async () => {
        if (action.status !== "success" || !action.projectId || discarding) {
            return;
        }
        const confirmed = window.confirm(
            "Discard this project? It will be removed from your library.",
        );
        if (!confirmed) return;
        const projectId = action.projectId;
        setDiscarding(true);
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: "DELETE",
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                throw new Error(
                    typeof data.error === "string"
                        ? data.error
                        : "Unable to discard this project.",
                );
            }
            void refresh();
            setAction({ key: null, status: "idle" });
        } catch (err) {
            setAction({
                key: action.key,
                status: "error",
                error:
                    err instanceof Error
                        ? err.message
                        : "Unable to discard this project.",
            });
        } finally {
            setDiscarding(false);
        }
    }, [action.key, action.projectId, action.status, discarding, refresh]);

    const stateParagraphs = splitParagraphs(sections.stateOfScience);
    // citationEvidence counts chips across the whole state text; give each
    // paragraph its own slice.
    const stateRefs = (() => {
        const all = refsFor("stateOfScience") ?? [];
        let used = 0;
        return stateParagraphs.map((paragraph) => {
            const count = splitCitedText(paragraph, paperCount).filter(
                (segment) => segment.type === "cite",
            ).length;
            const slice = all.slice(used, used + count);
            used += count;
            return slice;
        });
    })();
    const showError = action.status === "error";
    const outline = reportOutline(report);
    const entryFor = (id: ReportSectionId) =>
        outline.find((entry) => entry.id === id);
    const shows = (id: ReportSectionId) => !only || only.includes(id);
    const stateEntry = shows("state") ? entryFor("state") : undefined;
    const gapsEntry = shows("gaps") ? entryFor("gaps") : undefined;
    const problemsEntry = shows("problems") ? entryFor("problems") : undefined;
    const experimentsEntry = shows("experiments") ? entryFor("experiments") : undefined;
    const translationEntry = shows("translation") ? entryFor("translation") : undefined;
    const limitsEntry = shows("limits") ? entryFor("limits") : undefined;
    const focusNumber = Math.min(Math.max(selectedGap, 1), sections.gaps.length || 1);
    const focusGap = sections.gaps[focusNumber - 1];
    const focusCitations = (focusGap?.citations || []).filter(
        (index) => index >= 1 && index <= paperCount,
    );
    const focusPaper = papers.find((paper) => paper.index === focusCitations[0]);
    // What a gap chip cites: the evidence the gap's text names for that paper.
    const gapCite = (paperIndex: number): CiteContext => ({
        evidenceId: gapEvidenceId(sections.citationEvidence, focusNumber - 1, paperIndex),
        context: focusGap ? `${focusGap.title}. ${focusGap.description}` : "",
    });
    const focusPaperEvidence =
        focusPaper && evidenceFor
            ? evidenceFor(focusPaper.index, gapCite(focusPaper.index))
            : null;

    return (
        <div className={styles.briefGrid}>
            {showError && (
                <div className={styles.projectNotice} role="alert">
                    <span>{action.error}</span>
                    {action.errorStatus === 401 && (
                        <Link href="/login?next=%2Fdiscover">Sign in</Link>
                    )}
                    {(action.errorStatus === 403 ||
                        action.errorStatus === 429) && (
                        <Link href="/pricing">View plan options</Link>
                    )}
                </div>
            )}

            {stateEntry && stateParagraphs.length > 0 && (
                <section
                    id={reportSectionAnchor("state")}
                    className={styles.reportSection}
                >
                    <SectionHead entry={stateEntry} />
                    <article
                        className={clsx(
                            styles.briefCard,
                            styles.primaryBriefCard,
                        )}
                    >
                        <div className={styles.reportProse}>
                            {stateParagraphs.map((paragraph, index) => (
                                <p
                                    key={index}
                                    className={clsx({
                                        [styles.leadParagraph]:
                                            index === 0 &&
                                            stateParagraphs.length > 1,
                                    })}
                                >
                                    <CitedText
                                        text={paragraph}
                                        refs={stateRefs[index]}
                                        paperCount={paperCount}
                                        activePaperIndex={activePaperIndex}
                                        onCite={onCitePaper}
                                    />
                                </p>
                            ))}
                        </div>
                    </article>
                </section>
            )}

            {gapsEntry && focusGap && (
                <section
                    id={reportSectionAnchor("gaps")}
                    className={styles.gapBoard}
                    aria-label="Gaps in the science"
                >
                    <article
                        id="discover-gap-focus"
                        className={clsx(styles.gapFocus, {
                            [styles.gapCardHighlighted]:
                                highlightedGap === focusNumber,
                        })}
                        aria-labelledby="discover-gap-focus-title"
                    >
                        <div className={styles.gapFocusHead}>
                            <span className={styles.gapFocusLabel}>
                                {`Gap ${focusNumber}`}
                            </span>
                            <ConfidenceBadge value={focusGap.confidence} />
                        </div>
                        <h2
                            id="discover-gap-focus-title"
                            className={styles.gapFocusTitle}
                        >
                            {focusGap.title}
                        </h2>
                        {focusGap.description && (
                            <p className={styles.gapFocusText}>
                                <CitedText
                                    text={focusGap.description}
                                    refs={refsFor(`gaps.${focusNumber - 1}.description`)}
                                    paperCount={paperCount}
                                    activePaperIndex={activePaperIndex}
                                    onCite={onCitePaper}
                                />
                            </p>
                        )}
                        {focusGap.scopeNote ? (
                            <p className={styles.scopeNote}>{focusGap.scopeNote}</p>
                        ) : null}
                        {focusGap.whyItMatters && (
                            <p className={styles.whyItMatters}>
                                <strong>Why it matters</strong>
                                <CitedText
                                    text={focusGap.whyItMatters}
                                    refs={refsFor(`gaps.${focusNumber - 1}.whyItMatters`)}
                                    paperCount={paperCount}
                                    activePaperIndex={activePaperIndex}
                                    onCite={onCitePaper}
                                />
                            </p>
                        )}
                        {focusCitations.length > 0 && (
                            <div className={styles.gapFrom}>
                                <span className={styles.gapFromLabel}>From</span>
                                {focusCitations.map((index, position) =>
                                    position === 0 && focusPaper ? (
                                        <Link
                                            key={index}
                                            href={withReportOrigin(
                                                evidenceFocusHref(focusPaper.href, focusPaperEvidence),
                                                index,
                                                focusNumber,
                                                {
                                                    report: sourceDiscoveryId,
                                                    view: reportView,
                                                },
                                            )}
                                            className={styles.gapOpenPaper}
                                        >
                                            {`Paper ${index} · open paper chat →`}
                                        </Link>
                                    ) : (
                                        <button
                                            key={index}
                                            type="button"
                                            className={clsx(styles.gapPaperChip, {
                                                [styles.citationChipActive]:
                                                    activePaperIndex === index,
                                            })}
                                            aria-haspopup="dialog"
                                            aria-expanded={activePaperIndex === index}
                                            onClick={(event) =>
                                                onCitePaper(
                                                    index,
                                                    event.currentTarget,
                                                    gapCite(index),
                                                )
                                            }
                                        >
                                            {`Paper ${index}`}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                        {focusGap.activity ? (
                            <GapActivityView activity={focusGap.activity} />
                        ) : null}
                        <StartProjectButton
                            actionKey={`gap-${focusNumber}`}
                            action={action}
                            discarding={discarding}
                            onCancel={cancelProject}
                            onDiscard={() => void discardProject()}
                            onClick={() =>
                                void startProject(
                                    `gap-${focusNumber}`,
                                    focusGap.title,
                                    focusGap,
                                )
                            }
                        />
                    </article>
                    {sections.gaps.length > 1 && (
                        <div className={styles.gapList}>
                            {sections.gaps.map((gap, index) => {
                                const gapNumber = index + 1;
                                if (gapNumber === focusNumber) return null;
                                const cited = gap.citations.filter(
                                    (paper) => paper >= 1 && paper <= paperCount,
                                ).length;
                                const activity = gapActivitySummary(gap.activity);
                                return (
                                    <button
                                        key={`${gap.title}-${index}`}
                                        type="button"
                                        id={`discover-gap-${gapNumber}`}
                                        className={styles.gapItem}
                                        onClick={() => setSelectedGap(gapNumber)}
                                    >
                                        <span className={styles.gapItemLabel}>
                                            {`Gap ${gapNumber}`}
                                        </span>
                                        <span className={styles.gapItemTitle}>
                                            {gap.title}
                                        </span>
                                        <span className={styles.gapItemMeta}>
                                            {(CONFIDENCE_GUIDE[gap.confidence] ??
                                                CONFIDENCE_GUIDE.suggested).label}
                                            {cited > 0
                                                ? ` · ${pluralize(cited, "paper")}`
                                                : ""}
                                            {activity ? ` · ${activity}` : ""}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {problemsEntry && sections.problems.length > 0 && (
                <section
                    id={reportSectionAnchor("problems")}
                    className={styles.reportSection}
                >
                    <SectionHead
                        entry={problemsEntry}
                        countLabel={pluralize(
                            sections.problems.length,
                            "problem",
                        )}
                    />
                    <div className={styles.gapGrid}>
                        {sections.problems.map((problem, index) => (
                            <article
                                key={`${problem.title}-${index}`}
                                className={styles.gapCard}
                            >
                                <div className={styles.gapCardHeader}>
                                    <span>{`Problem ${index + 1}`}</span>
                                </div>
                                <h4>{problem.title}</h4>
                                {problem.description && (
                                    <p>
                                        <CitedText
                                            text={problem.description}
                                            refs={refsFor(`problems.${index}.description`)}
                                            paperCount={paperCount}
                                            activePaperIndex={activePaperIndex}
                                            onCite={onCitePaper}
                                        />
                                    </p>
                                )}
                                {problem.gapRefs.length > 0 && (
                                    <div className={styles.citationRow}>
                                        {problem.gapRefs.map((gapRef) => (
                                            <button
                                                key={gapRef}
                                                type="button"
                                                className={styles.gapRefChip}
                                                onClick={() =>
                                                    scrollToGap(gapRef)
                                                }
                                            >
                                                {`from Gap ${gapRef}`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {experimentsEntry && sections.projectSeeds.length > 0 && (
                <section
                    id={reportSectionAnchor("experiments")}
                    className={styles.reportSection}
                >
                    <SectionHead
                        entry={experimentsEntry}
                        countLabel={pluralize(
                            sections.projectSeeds.length,
                            "experiment",
                        )}
                    />
                    <div className={styles.gapGrid}>
                        {sections.projectSeeds.map((seed, index) => {
                            const seedKey = `seed-${index + 1}`;
                            const gap = resolveSeedGap(seed, sections.gaps);
                            return (
                                <article
                                    key={`${seed.title}-${index}`}
                                    className={clsx(
                                        styles.gapCard,
                                        styles.seedCard,
                                    )}
                                >
                                    <div className={styles.gapCardHeader}>
                                        <span>
                                            {`Experiment ${index + 1}`}
                                        </span>
                                        {seed.gapRef >= 1 && (
                                            <button
                                                type="button"
                                                className={styles.gapRefChip}
                                                onClick={() =>
                                                    scrollToGap(seed.gapRef)
                                                }
                                            >
                                                {`closes Gap ${seed.gapRef}`}
                                            </button>
                                        )}
                                    </div>
                                    <h4>{seed.title}</h4>
                                    {seed.oneLiner && (
                                        <p>
                                            <CitedText
                                                text={seed.oneLiner}
                                                refs={refsFor(`projectSeeds.${index}.oneLiner`)}
                                                paperCount={paperCount}
                                                activePaperIndex={activePaperIndex}
                                                onCite={onCitePaper}
                                            />
                                        </p>
                                    )}
                                    <StartProjectButton
                                        actionKey={seedKey}
                                        action={action}
                                        discarding={discarding}
                                        onCancel={cancelProject}
                                        onDiscard={() => void discardProject()}
                                        onClick={() =>
                                            void startProject(
                                                seedKey,
                                                seed.title,
                                                gap,
                                            )
                                        }
                                    />
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {translationEntry && sections.venturePotential.length > 0 && (
                <section
                    id={reportSectionAnchor("translation")}
                    className={styles.reportSection}
                >
                    <SectionHead
                        entry={translationEntry}
                        countLabel={pluralize(
                            sections.venturePotential.length,
                            "opportunity",
                            "opportunities",
                        )}
                    />
                    <div className={styles.gapGrid}>
                        {sections.venturePotential.map((item, index) => (
                            <article
                                key={`${item.title}-${index}`}
                                className={styles.gapCard}
                            >
                                <div className={styles.gapCardHeader}>
                                    <span>{`Opportunity ${index + 1}`}</span>
                                    <span className={styles.analysisTag}>
                                        Analysis, not advice
                                    </span>
                                </div>
                                <h4>{item.title}</h4>
                                {item.thesis && (
                                    <p>
                                        <CitedText
                                            text={item.thesis}
                                            refs={refsFor(`venturePotential.${index}.thesis`)}
                                            paperCount={paperCount}
                                            activePaperIndex={activePaperIndex}
                                            onCite={onCitePaper}
                                        />
                                    </p>
                                )}
                                {item.feasibilitySignals && (
                                    <p className={styles.ventureField}>
                                        <strong>Feasibility</strong>
                                        <CitedText
                                            text={item.feasibilitySignals}
                                            refs={refsFor(`venturePotential.${index}.feasibilitySignals`)}
                                            paperCount={paperCount}
                                            activePaperIndex={activePaperIndex}
                                            onCite={onCitePaper}
                                        />
                                    </p>
                                )}
                                {item.risks && (
                                    <p className={styles.ventureField}>
                                        <strong>Risks</strong>
                                        <CitedText
                                            text={item.risks}
                                            refs={refsFor(`venturePotential.${index}.risks`)}
                                            paperCount={paperCount}
                                            activePaperIndex={activePaperIndex}
                                            onCite={onCitePaper}
                                        />
                                    </p>
                                )}
                                <CitationChips
                                    citations={item.citations}
                                    paperCount={paperCount}
                                    activePaperIndex={activePaperIndex}
                                    onCite={onCitePaper}
                                />
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {limitsEntry && sections.couldNotVerify.length > 0 && (
                <section
                    id={reportSectionAnchor("limits")}
                    className={styles.reportSection}
                >
                    <SectionHead
                        entry={limitsEntry}
                        countLabel={pluralize(
                            sections.couldNotVerify.length,
                            "note",
                        )}
                    />
                    <article className={clsx(styles.briefCard, styles.limitsCard)}>
                        <ul className={styles.couldNotVerify}>
                            {sections.couldNotVerify.map((item, index) => (
                                <li key={`${item}-${index}`}>
                                    <CitedText
                                        text={item}
                                        refs={refsFor(`couldNotVerify.${index}`)}
                                        paperCount={paperCount}
                                        activePaperIndex={activePaperIndex}
                                        onCite={onCitePaper}
                                    />
                                </li>
                            ))}
                        </ul>
                    </article>
                </section>
            )}
        </div>
    );
}
