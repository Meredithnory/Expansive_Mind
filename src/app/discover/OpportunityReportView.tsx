"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import styles from "./discover.module.scss";
import type {
    OpportunityReport,
    PaperExtraction,
    ProjectSeed,
    ReportConfidence,
    ReportGap,
} from "../api/discover/report-types";
import {
    ledgerCounts,
    supportRelationLabel,
} from "../lib/claim-evidence";
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

type CitePaper = (index: number, trigger?: HTMLElement | null) => void;

function CitedText({
    text,
    paperCount,
    activePaperIndex,
    onCite,
}: {
    text: string;
    paperCount: number;
    activePaperIndex?: number | null;
    onCite: CitePaper;
}) {
    const segments = splitCitedText(text, paperCount);
    return (
        <>
            {segments.map((segment, index) =>
                segment.type === "cite" ? (
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
                            onCite(segment.index, event.currentTarget);
                        }}
                    >
                        {segment.label}
                    </button>
                ) : (
                    <React.Fragment key={`text-${index}`}>
                        {segment.value}
                    </React.Fragment>
                ),
            )}
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
    extractions,
    isLoggedIn,
    sourceDiscoveryId,
    activePaperIndex,
    onCitePaper,
    onGuestUpgrade,
}: {
    report: OpportunityReport;
    paperCount: number;
    extractions?: PaperExtraction[];
    isLoggedIn: boolean;
    sourceDiscoveryId: string | undefined;
    activePaperIndex?: number | null;
    onCitePaper: CitePaper;
    onGuestUpgrade: () => void;
}) {
    const { sections } = report;
    const { refresh } = useSession();
    const [highlightedGap, setHighlightedGap] = useState<number | null>(null);
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

    const scrollToGap = useCallback((gapIndex: number) => {
        const target = document.getElementById(`discover-gap-${gapIndex}`);
        if (!target) return;
        setHighlightedGap(gapIndex);
        target.scrollIntoView({ behavior: "smooth", block: "center" });
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

    const claimLedger = (extractions ?? []).flatMap(
        (extraction) => extraction.claims ?? [],
    );
    const claimCounts = ledgerCounts(claimLedger);
    const stateParagraphs = splitParagraphs(sections.stateOfScience);
    const showError = action.status === "error";
    const outline = reportOutline(report);
    const entryFor = (id: ReportSectionId) =>
        outline.find((entry) => entry.id === id);
    const stateEntry = entryFor("state");
    const gapsEntry = entryFor("gaps");
    const problemsEntry = entryFor("problems");
    const experimentsEntry = entryFor("experiments");
    const translationEntry = entryFor("translation");
    const limitsEntry = entryFor("limits");

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

            {claimLedger.length > 0 && (
                <section
                    className={styles.reportSection}
                    aria-label="Claim ledger"
                >
                    <details className={styles.ledger}>
                        <summary>
                            Claim ledger · {claimCounts.located} of{" "}
                            {claimCounts.total} have a located passage ·{" "}
                            {claimCounts.directSupport} classified as direct
                            support
                        </summary>
                        <p className={styles.scopeNote}>
                            A located passage was checked by machine against
                            the licensed excerpt. That is not human review. A
                            DOI or paper number alone is not support.
                        </p>
                        <div className={styles.gapGrid}>
                            {claimLedger.map((claim) => (
                                <article
                                    key={claim.claimId}
                                    className={styles.gapCard}
                                >
                                    <div className={styles.gapCardHeader}>
                                        <span>{claim.paperId}</span>
                                        <span>
                                            {supportRelationLabel(
                                                claim.supportRelation,
                                            )}
                                        </span>
                                    </div>
                                    <h4>{claim.claimText}</h4>
                                    <p>
                                        Population match: {claim.populationMatch}
                                        .{" "}
                                        {claim.verificationStatus ===
                                        "machine_checked"
                                            ? "Machine-checked. Not human review."
                                            : "Not checked against a passage."}
                                    </p>
                                    {claim.passageText ? (
                                        <blockquote className={styles.ledgerQuote}>
                                            {claim.passageText}
                                        </blockquote>
                                    ) : (
                                        <p>No source passage verified.</p>
                                    )}
                                    {claim.passageLocator ? (
                                        <p>{claim.passageLocator}</p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    </details>
                </section>
            )}

            {gapsEntry && sections.gaps.length > 0 && (
                <section
                    id={reportSectionAnchor("gaps")}
                    className={styles.reportSection}
                >
                    <SectionHead
                        entry={gapsEntry}
                        countLabel={pluralize(sections.gaps.length, "gap")}
                    />
                    <div className={styles.gapGrid}>
                        {sections.gaps.map((gap, index) => {
                            const gapNumber = index + 1;
                            return (
                                <article
                                    key={`${gap.title}-${index}`}
                                    id={`discover-gap-${gapNumber}`}
                                    className={clsx(styles.gapCard, {
                                        [styles.gapCardHighlighted]:
                                            highlightedGap === gapNumber,
                                    })}
                                >
                                    <div className={styles.gapCardHeader}>
                                        <span>{`Gap ${gapNumber}`}</span>
                                        <ConfidenceBadge
                                            value={gap.confidence}
                                        />
                                    </div>
                                    <h4>{gap.title}</h4>
                                    {gap.description && (
                                        <p>
                                        <CitedText
                                            text={gap.description}
                                            paperCount={paperCount}
                                            activePaperIndex={activePaperIndex}
                                            onCite={onCitePaper}
                                        />
                                        </p>
                                    )}
                                    {gap.scopeNote ? (
                                        <p className={styles.scopeNote}>
                                            {gap.scopeNote}
                                        </p>
                                    ) : null}
                                    {gap.whyItMatters && (
                                        <p className={styles.whyItMatters}>
                                            <strong>Why it matters</strong>
                                        <CitedText
                                            text={gap.whyItMatters}
                                            paperCount={paperCount}
                                            activePaperIndex={activePaperIndex}
                                            onCite={onCitePaper}
                                        />
                                        </p>
                                    )}
                                    <CitationChips
                                        citations={gap.citations}
                                        paperCount={paperCount}
                                        activePaperIndex={activePaperIndex}
                                        onCite={onCitePaper}
                                    />
                                    <StartProjectButton
                                        actionKey={`gap-${gapNumber}`}
                                        action={action}
                                        discarding={discarding}
                                        onCancel={cancelProject}
                                        onDiscard={() => void discardProject()}
                                        onClick={() =>
                                            void startProject(
                                                `gap-${gapNumber}`,
                                                gap.title,
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
                                        <p>{seed.oneLiner}</p>
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
                                <li key={`${item}-${index}`}>{item}</li>
                            ))}
                        </ul>
                    </article>
                </section>
            )}
        </div>
    );
}
