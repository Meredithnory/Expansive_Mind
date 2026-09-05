"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import styles from "./discover.module.scss";
import type {
    OpportunityReport,
    ProjectSeed,
    ReportConfidence,
    ReportGap,
} from "../api/discover/report-types";
import { useSession } from "../lib/use-session";
import { splitCitedText, splitParagraphs } from "./report-text";
import ClaimLedgerView from "./ClaimLedgerView";

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
                        onClick={(event) =>
                            onCite(segment.index, event.currentTarget)
                        }
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
                    onClick={(event) => onCite(index, event.currentTarget)}
                >
                    {`Paper ${index}`}
                </button>
            ))}
        </div>
    );
}

function ConfidenceBadge({ value }: { value: ReportConfidence }) {
    return (
        <span
            className={clsx(styles.confidenceBadge, {
                [styles.confidenceEstablished]: value === "established",
                [styles.confidenceSuggested]: value === "suggested",
                [styles.confidenceSpeculative]: value === "speculative",
            })}
        >
            {value}
        </span>
    );
}

function StartProjectButton({
    actionKey,
    action,
    onClick,
}: {
    actionKey: string;
    action: ProjectActionState;
    onClick: () => void;
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
                <p className={styles.projectLoadingMessage} role="status">
                    Setting up your workspace and research plan. This usually
                    takes a few seconds.
                </p>
            )}
            {isSuccess && action.projectId && (
                <p className={styles.projectConfirm}>
                    Project created.{" "}
                    <Link href={`/projects/${action.projectId}`}>
                        Open project
                    </Link>
                </p>
            )}
        </div>
    );
}

export default function OpportunityReportView({
    report,
    paperCount,
    isLoggedIn,
    sourceDiscoveryId,
    activePaperIndex,
    onCitePaper,
    onGuestUpgrade,
}: {
    report: OpportunityReport;
    paperCount: number;
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
            setAction({ key, status: "loading" });
            try {
                const response = await fetch("/api/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title,
                        sourceDiscoveryId,
                        gap: gapPayload(gap),
                    }),
                });
                const data = await response.json().catch(() => ({}));
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
                const project = data.project as
                    | { id?: unknown; _id?: unknown }
                    | undefined;
                const projectId =
                    typeof project?.id === "string"
                        ? project.id
                        : typeof project?._id === "string"
                          ? project._id
                          : "";
                if (!projectId) {
                    throw Object.assign(
                        new Error("Unable to start this project."),
                        { status: response.status },
                    );
                }
                setAction({ key, status: "success", projectId });
            } catch (err) {
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
            }
        },
        [isLoggedIn, onGuestUpgrade, refresh, sourceDiscoveryId],
    );

    const stateParagraphs = splitParagraphs(sections.stateOfScience);
    const showError = action.status === "error";

    return (
        <div className={styles.briefGrid}>
            {report.claimLedger ? (
                <ClaimLedgerView
                    ledger={report.claimLedger}
                    activePaperIndex={activePaperIndex}
                    onCitePaper={onCitePaper}
                />
            ) : null}
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

            {stateParagraphs.length > 0 && (
                <article
                    className={clsx(styles.briefCard, styles.primaryBriefCard)}
                >
                    <div className={styles.briefCardHeader}>
                        <span>01</span>
                        <h3>State of the science</h3>
                    </div>
                    <div className={styles.reportProse}>
                        {stateParagraphs.map((paragraph, index) => (
                            <p key={index}>
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
            )}

            {sections.gaps.length > 0 && (
                <section className={styles.reportSection}>
                    <div className={styles.reportSectionHeading}>
                        <h3>Gaps in the science</h3>
                        <span>{sections.gaps.length} gaps</span>
                    </div>
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

            {sections.problems.length > 0 && (
                <section className={styles.reportSection}>
                    <div className={styles.reportSectionHeading}>
                        <h3>Problems these gaps could solve</h3>
                    </div>
                    <div className={styles.gapGrid}>
                        {sections.problems.map((problem, index) => (
                            <article
                                key={`${problem.title}-${index}`}
                                className={styles.gapCard}
                            >
                                <div className={styles.gapCardHeader}>
                                    <span>
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
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

            {sections.venturePotential.length > 0 && (
                <section className={styles.reportSection}>
                    <div className={styles.reportSectionHeading}>
                        <h3>Translation notes</h3>
                    </div>
                    <p className={styles.ventureDisclaimer}>
                        Analysis of technical signals in the literature, not
                        investment advice.
                    </p>
                    <div className={styles.gapGrid}>
                        {sections.venturePotential.map((item, index) => (
                            <article
                                key={`${item.title}-${index}`}
                                className={styles.gapCard}
                            >
                                <div className={styles.gapCardHeader}>
                                    <span>
                                        {String(index + 1).padStart(2, "0")}
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

            {sections.couldNotVerify.length > 0 && (
                <article className={styles.briefCard}>
                    <div className={styles.briefCardHeader}>
                        <h3>What we could not verify</h3>
                    </div>
                    <ul className={styles.couldNotVerify}>
                        {sections.couldNotVerify.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>
                </article>
            )}

            {sections.projectSeeds.length > 0 && (
                <section className={styles.reportSection}>
                    <div className={styles.reportSectionHeading}>
                        <h3>Next experiments</h3>
                    </div>
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
                                            {String(index + 1).padStart(
                                                2,
                                                "0",
                                            )}
                                        </span>
                                        {seed.gapRef >= 1 && (
                                            <button
                                                type="button"
                                                className={styles.gapRefChip}
                                                onClick={() =>
                                                    scrollToGap(seed.gapRef)
                                                }
                                            >
                                                {`from Gap ${seed.gapRef}`}
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
        </div>
    );
}
