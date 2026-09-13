"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { LoadingOverlay } from "../../components/Loading";
import { useSession } from "../../lib/use-session";
import {
    type ProjectStepStatus,
    type SerializedProject,
} from "../../lib/project-types";
import { buildPaperFocusHref } from "../../lib/paper-sources";
import styles from "./project-detail.module.scss";

const NOTES_DEBOUNCE_MS = 700;

function formatCreatedAt(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function researchButtonLabel(
    researching: boolean,
    project: SerializedProject,
) {
    if (researching) return "Researching…";
    if (project.briefing) return "Dig deeper";
    return "Research this gap";
}

function PaperAnchor({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    if (href.startsWith("/")) {
        return (
            <Link href={href} className={styles.paperLink}>
                {children}
            </Link>
        );
    }
    return (
        <a
            href={href}
            className={styles.paperLink}
            target="_blank"
            rel="noreferrer"
        >
            {children}
        </a>
    );
}

type ProjectDetailClientProps = {
    projectId: string;
    loadingHeader: ReactNode;
};

const ProjectDetailClient = ({ projectId, loadingHeader }: ProjectDetailClientProps) => {
    const router = useRouter();
    const { isLoggedIn, loading: sessionLoading } = useSession();
    const [project, setProject] = useState<SerializedProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notes, setNotes] = useState("");
    const [notesState, setNotesState] = useState<"saved" | "saving" | "error">(
        "saved",
    );
    const [deleting, setDeleting] = useState(false);
    const [researching, setResearching] = useState(false);
    const [researchError, setResearchError] = useState("");

    const loadProject = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                cache: "no-store",
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                setProject(null);
                return;
            }
            if (!response.ok) {
                throw new Error(data.error || "Unable to load this project.");
            }
            setProject(data.project);
            setNotes(data.project?.notes ?? "");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load this project.",
            );
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (sessionLoading) return;
        if (!isLoggedIn) {
            setLoading(false);
            setProject(null);
            return;
        }
        void loadProject();
    }, [sessionLoading, isLoggedIn, loadProject]);

    const patchProject = useCallback(
        async (body: Record<string, unknown>) => {
            if (!projectId) return null;
            const response = await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Unable to update this project.");
            }
            setProject(data.project);
            return data.project as SerializedProject;
        },
        [projectId],
    );

    useEffect(() => {
        if (!project || notes === project.notes) return;
        const timer = window.setTimeout(() => {
            setNotesState("saving");
            void patchProject({ notes })
                .then(() => setNotesState("saved"))
                .catch(() => setNotesState("error"));
        }, NOTES_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [notes, project, patchProject]);

    const methodCueByPaper = useMemo(() => {
        const map = new Map<number, string>();
        for (const item of project?.briefing?.alreadyTried ?? []) {
            if (item.method) map.set(item.paperIndex, item.method);
        }
        return map;
    }, [project]);

    const paperHref = useCallback(
        (paper: SerializedProject["papers"][number]) => {
            if (!paper.href.startsWith("/")) return paper.href;
            return buildPaperFocusHref(
                paper.href,
                methodCueByPaper.get(paper.index),
            );
        },
        [methodCueByPaper],
    );

    const papersByIndex = useMemo(() => {
        const map = new Map<number, SerializedProject["papers"][number]>();
        for (const paper of project?.papers ?? []) {
            map.set(paper.index, paper);
        }
        return map;
    }, [project]);

    async function updateStepStatus(
        stepIndex: number,
        status: ProjectStepStatus,
    ) {
        if (!project) return;
        const previous = project;
        setProject({
            ...project,
            plan: project.plan.map((step, index) =>
                index === stepIndex ? { ...step, status } : step,
            ),
        });
        try {
            await patchProject({ stepIndex, status });
        } catch (err) {
            console.error(err);
            setProject(previous);
        }
    }

    async function researchProject() {
        if (!projectId || researching) return;
        setResearching(true);
        setResearchError("");
        try {
            const response = await fetch(
                `/api/projects/${projectId}/research`,
                { method: "POST" },
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to research this project.",
                );
            }
            setProject(data.project);
        } catch (err) {
            setResearchError(
                err instanceof Error
                    ? err.message
                    : "Unable to research this project.",
            );
        } finally {
            setResearching(false);
        }
    }

    async function deleteProject() {
        if (!project) return;
        if (
            !window.confirm(
                `Cancel “${project.title}”? This removes it from your library and cannot be undone.`,
            )
        ) {
            return;
        }
        setDeleting(true);
        try {
            const response = await fetch(`/api/projects/${project.id}`, {
                method: "DELETE",
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to delete project.");
            }
            router.push("/savedpapers?tab=projects");
        } catch (err) {
            console.error(err);
            setDeleting(false);
        }
    }

    const completedSteps =
        project?.plan.filter((step) => step.status === "done").length ?? 0;
    const progress = project
        ? `${completedSteps}/${project.plan.length} steps complete`
        : "";
    const progressPercent =
        project && project.plan.length > 0
            ? Math.round((completedSteps / project.plan.length) * 100)
            : 0;

    if (!sessionLoading && !isLoggedIn) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>Sign in to view projects</p>
                    <p className={styles.emptyMessage}>
                        Research roadmaps are saved to your account.
                    </p>
                    <Link href="/login" className={styles.searchButton}>
                        Sign in
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <LoadingOverlay
                visible={loading && isLoggedIn}
                label="Loading project…"
            />
            {loading && !project ? loadingHeader : null}
            {error && !project ? (
                <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>Project unavailable</p>
                    <p className={styles.emptyMessage}>{error}</p>
                    <Link href="/savedpapers?tab=projects" className={styles.searchButton}>
                        Back to Research Library
                    </Link>
                </div>
            ) : project ? (
                <div className={styles.content}>
                    <header className={styles.header}>
                        <div className={styles.headerCopy}>
                            <Link href="/savedpapers?tab=projects" className={styles.backLink}>
                                <span aria-hidden="true">‹</span>
                                Research Library
                            </Link>
                            <p className={styles.eyebrow}>Research plan</p>
                            <h1 className={styles.title}>{project.title}</h1>
                            <p className={styles.meta}>
                                {formatCreatedAt(project.createdAt)}
                                {progress ? ` · ${progress}` : ""}
                            </p>
                            <div
                                className={styles.progressTrack}
                                role="progressbar"
                                aria-label="Research plan progress"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progressPercent}
                            >
                                <span style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                        <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => void deleteProject()}
                            disabled={deleting}
                        >
                            {deleting ? "Canceling…" : "Cancel project"}
                        </button>
                    </header>

                    <section className={`${styles.card} ${styles.gapCard}`}>
                        <h2 className={styles.sectionTitle}>Gap</h2>
                        <h3 className={styles.gapTitle}>{project.gap.title}</h3>
                        <p className={styles.prose}>{project.gap.description}</p>
                        {project.gap.whyItMatters ? (
                            <p className={styles.prose}>
                                {project.gap.whyItMatters}
                            </p>
                        ) : null}
                        <div className={styles.chipRow}>
                            {project.gap.confidence ? (
                                <span className={styles.chip}>
                                    {project.gap.confidence}
                                </span>
                            ) : null}
                            {project.gap.citations.map((index) => (
                                <span key={index} className={styles.chip}>
                                    Paper {index}
                                </span>
                            ))}
                        </div>
                    </section>

                    <section className={`${styles.card} ${styles.evidenceCard}`}>
                        <div className={styles.sectionHeading}>
                            <h2 className={styles.sectionTitle}>
                                Research already done
                            </h2>
                            <button
                                type="button"
                                className={styles.researchButton}
                                onClick={() => void researchProject()}
                                disabled={researching}
                            >
                                {researchButtonLabel(researching, project)}
                            </button>
                        </div>
                        {researchError ? (
                            <p className={styles.researchError} role="alert">
                                {researchError}
                            </p>
                        ) : null}
                        {project.briefing ? (
                            <div className={styles.briefing}>
                                {project.briefing.nextMove ? (
                                    <article className={styles.nextMove}>
                                        <p className={styles.briefingKicker}>
                                            Next experiment
                                        </p>
                                        <h3>{project.briefing.nextMove.title}</h3>
                                        <dl className={styles.nextMoveFields}>
                                            {project.briefing.nextMove.model ? (
                                                <div>
                                                    <dt>Model</dt>
                                                    <dd>
                                                        {
                                                            project.briefing
                                                                .nextMove.model
                                                        }
                                                    </dd>
                                                </div>
                                            ) : null}
                                            {project.briefing.nextMove
                                                .comparison ? (
                                                <div>
                                                    <dt>Comparison</dt>
                                                    <dd>
                                                        {
                                                            project.briefing
                                                                .nextMove
                                                                .comparison
                                                        }
                                                    </dd>
                                                </div>
                                            ) : null}
                                            {project.briefing.nextMove
                                                .readout ? (
                                                <div>
                                                    <dt>Readout</dt>
                                                    <dd>
                                                        {
                                                            project.briefing
                                                                .nextMove
                                                                .readout
                                                        }
                                                    </dd>
                                                </div>
                                            ) : null}
                                        </dl>
                                    </article>
                                ) : null}
                                {project.briefing.alreadyTried.length > 0 ? (
                                    <div className={styles.triedList}>
                                        <h3 className={styles.briefingSubhead}>
                                            What the papers already tried
                                        </h3>
                                        <ul>
                                            {project.briefing.alreadyTried.map(
                                                (item) => {
                                                    const paper =
                                                        papersByIndex.get(
                                                            item.paperIndex,
                                                        );
                                                    return (
                                                        <li
                                                            key={`${item.paperIndex}-${item.method}`}
                                                        >
                                                            <p>
                                                                <strong>
                                                                    Paper{" "}
                                                                    {
                                                                        item.paperIndex
                                                                    }
                                                                </strong>
                                                                {item.method
                                                                    ? ` · ${item.method}`
                                                                    : ""}
                                                            </p>
                                                            {item.finding ? (
                                                                <p
                                                                    className={
                                                                        styles.prose
                                                                    }
                                                                >
                                                                    {
                                                                        item.finding
                                                                    }
                                                                </p>
                                                            ) : null}
                                                            {paper ? (
                                                                <PaperAnchor
                                                                    href={paperHref(
                                                                        paper,
                                                                    )}
                                                                >
                                                                    {paper.href.startsWith(
                                                                        "/",
                                                                    )
                                                                        ? "Show method in paper"
                                                                        : "Open paper"}
                                                                </PaperAnchor>
                                                            ) : null}
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ul>
                                    </div>
                                ) : null}
                                {project.briefing.stillOpen.length > 0 ? (
                                    <div>
                                        <h3 className={styles.briefingSubhead}>
                                            Still open
                                        </h3>
                                        <ul className={styles.openList}>
                                            {project.briefing.stillOpen.map(
                                                (item) => (
                                                    <li key={item}>{item}</li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                ) : null}
                                {project.briefing.couldNotVerify.length >
                                0 ? (
                                    <p className={styles.notesHint}>
                                        Could not verify:{" "}
                                        {project.briefing.couldNotVerify.join(
                                            " · ",
                                        )}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <p className={styles.prose}>
                                Start a research pass on this gap. The agent
                                will extract what was already tried and propose
                                the next experiment from the cited papers.
                            </p>
                        )}
                    </section>

                    <section className={`${styles.card} ${styles.roadmapCard}`}>
                        <div className={styles.roadmapHeading}>
                            <div>
                                <p className={styles.sectionKicker}>Execution</p>
                                <h2 className={styles.sectionTitle}>Research roadmap</h2>
                            </div>
                            <span>{progress}</span>
                        </div>
                        <ol className={styles.stepList}>
                            {project.plan.map((step, index) => (
                                <li
                                    key={`${step.title}-${index}`}
                                    className={`${styles.step}${
                                        step.status === "done"
                                            ? ` ${styles.stepDone}`
                                            : ""
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className={styles.stepCheck}
                                        aria-label={
                                            step.status === "done"
                                                ? `Mark step ${index + 1} incomplete`
                                                : `Mark step ${index + 1} complete`
                                        }
                                        aria-pressed={step.status === "done"}
                                        onClick={() =>
                                            void updateStepStatus(
                                                index,
                                                step.status === "done"
                                                    ? "pending"
                                                    : "done",
                                            )
                                        }
                                    >
                                        <svg
                                            viewBox="0 0 16 16"
                                            aria-hidden="true"
                                        >
                                            <path d="m4 8.25 2.45 2.4L12.2 5" />
                                        </svg>
                                    </button>
                                    <div className={styles.stepBody}>
                                        <div className={styles.stepHeader}>
                                            <span className={styles.stepIndex}>
                                                Step {index + 1}
                                            </span>
                                        </div>
                                        <h3 className={styles.stepTitle}>
                                            {step.title}
                                        </h3>
                                        {step.description ? (
                                            <p className={styles.prose}>
                                                {step.description}
                                            </p>
                                        ) : null}
                                        {step.paperRefs.length > 0 ? (
                                            <div className={styles.paperLinks}>
                                                {step.paperRefs.map((ref) => {
                                                    const paper =
                                                        papersByIndex.get(ref);
                                                    const label = `Paper ${ref}`;
                                                    if (!paper?.href) {
                                                        return (
                                                            <span key={ref}>
                                                                {label}
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <PaperAnchor
                                                            key={ref}
                                                            href={paperHref(paper)}
                                                        >
                                                            {label}: {paper.title}
                                                        </PaperAnchor>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    {project.papers.length > 0 ? (
                        <section className={`${styles.card} ${styles.sourcesCard}`}>
                            <h2 className={styles.sectionTitle}>Linked papers</h2>
                            <div className={styles.paperLinks}>
                                {project.papers.map((paper) => (
                                    <PaperAnchor
                                        key={`${paper.database}-${paper.paperId}`}
                                        href={paperHref(paper)}
                                    >
                                        [{paper.index}] {paper.title}
                                    </PaperAnchor>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className={`${styles.card} ${styles.notesCard}`}>
                        <h2 className={styles.sectionTitle}>Notes</h2>
                        <textarea
                            className={styles.notes}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Lab notes, thesis angles, next experiments…"
                            maxLength={20_000}
                        />
                        <p className={styles.notesHint}>
                            {notesState === "saving"
                                ? "Saving…"
                                : notesState === "error"
                                  ? "Could not save notes. They will retry when you edit again."
                                  : "Notes save automatically."}
                        </p>
                    </section>
                </div>
            ) : null}
        </div>
    );
};

export default ProjectDetailClient;
