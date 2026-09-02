"use client";

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import SavedPaper from "../components/SavedPaper";
import { Paper } from "../components/SavedPaper";
import styles from "./savedpage.module.scss";
import Link from "next/link";
import { LoadingOverlay } from "../components/Loading";
import type { SerializedProject } from "../lib/project-types";

const PAPERS_PER_PAGE = 6;
type LibraryTab = "papers" | "syntheses" | "projects";

type SavedSynthesis = {
    id: string;
    question: string;
    createdAt: string;
    papers?: unknown[];
    meta?: { papersUsed?: number };
};

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function projectProgress(project: SerializedProject) {
    return {
        done: project.plan.filter((step) => step.status === "done").length,
        total: project.plan.length,
    };
}

type SavedLibraryClientProps = {
    initialTab: LibraryTab;
    header: ReactNode;
};

const SavedLibraryClient = ({ initialTab, header }: SavedLibraryClientProps) => {
    const [allPapers, setAllPapers] = useState<Paper[]>([]);
    const [syntheses, setSyntheses] = useState<SavedSynthesis[]>([]);
    const [projects, setProjects] = useState<SerializedProject[]>([]);
    const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const fetchLibrary = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [papersResponse, synthesesResponse, projectsResponse] =
                await Promise.all([
                    fetch("/api/all-user-papers", { cache: "no-store" }),
                    fetch("/api/discover", { cache: "no-store" }),
                    fetch("/api/projects", { cache: "no-store" }),
                ]);
            const [papersData, synthesesData, projectsData] = await Promise.all([
                papersResponse.json(),
                synthesesResponse.json(),
                projectsResponse.json(),
            ]);

            if (!papersResponse.ok || !synthesesResponse.ok || !projectsResponse.ok) {
                throw new Error("Some library items could not be loaded.");
            }
            setAllPapers(Array.isArray(papersData.papers) ? papersData.papers : []);
            setSyntheses(
                Array.isArray(synthesesData.discoveries)
                    ? synthesesData.discoveries
                    : [],
            );
            setProjects(
                Array.isArray(projectsData.projects) ? projectsData.projects : [],
            );
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to load your library.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchLibrary();
    }, [fetchLibrary]);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);


    const totalPages = Math.max(
        1,
        Math.ceil(allPapers.length / PAPERS_PER_PAGE),
    );

    useEffect(() => {
        setCurrentPage((prev) => Math.min(prev, totalPages));
    }, [totalPages]);

    const startIndex = (currentPage - 1) * PAPERS_PER_PAGE;
    const visiblePapers = allPapers.slice(
        startIndex,
        startIndex + PAPERS_PER_PAGE,
    );
    const counts = useMemo(
        () => ({
            papers: allPapers.length,
            syntheses: syntheses.length,
            projects: projects.length,
        }),
        [allPapers.length, projects.length, syntheses.length],
    );

    async function deletePaper(paper: Paper) {
        setAllPapers((prev) =>
            prev.filter(
                (saved) =>
                    !(
                        saved.paperId === paper.paperId &&
                        saved.idName === paper.idName &&
                        saved.primarySource === paper.primarySource
                    ),
            ),
        );

        try {
            const res = await fetch("/api/delete-paper", {
                method: "DELETE",
                body: JSON.stringify({
                    primarySource: paper.primarySource,
                    paperId: paper.paperId,
                    idName: paper.idName,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
        } catch (err) {
            console.error("Error deleting paper:", err);
            void fetchLibrary();
        }
    }

    async function deleteSynthesis(synthesis: SavedSynthesis) {
        if (!window.confirm(`Delete “${synthesis.question}”?`)) return;
        setSyntheses((current) =>
            current.filter((item) => item.id !== synthesis.id),
        );
        const response = await fetch("/api/discover", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: synthesis.id }),
        });
        if (!response.ok) void fetchLibrary();
    }

    async function deleteProject(project: SerializedProject) {
        if (!window.confirm(`Delete “${project.title}”?`)) return;
        setProjects((current) =>
            current.filter((item) => item.id !== project.id),
        );
        const response = await fetch(`/api/projects/${project.id}`, {
            method: "DELETE",
        });
        if (!response.ok) void fetchLibrary();
    }

    const tabs: Array<{ id: LibraryTab; label: string }> = [
        { id: "papers", label: "Papers" },
        { id: "syntheses", label: "Syntheses" },
        { id: "projects", label: "Research plans" },
    ];

    return (
        <>
            <LoadingOverlay visible={loading} label="Loading your library…" />
            {header}
                <div className={styles.tabs} role="tablist" aria-label="Library">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={activeTab === tab.id ? styles.activeTab : ""}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label} <span>{counts[tab.id]}</span>
                        </button>
                    ))}
                </div>
                {loading ? (
                    <div className={styles.savedPapersSkeleton} aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5].map((item) => (
                            <div
                                key={item}
                                className={`${styles.savedPaperSkeletonCard} loading-skeleton`}
                            />
                        ))}
                    </div>
                ) : error ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyTitle}>Library unavailable</p>
                        <p className={styles.emptyMessage}>{error}</p>
                        <button className={styles.searchButton} onClick={fetchLibrary}>
                            Try again
                        </button>
                    </div>
                ) : activeTab === "papers" ? (
                    allPapers.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p className={styles.emptyTitle}>No saved papers yet</p>
                            <p className={styles.emptyMessage}>
                                Open a paper from a synthesis or quick search and
                                save it here for later.
                            </p>
                            <Link href="/searchpaper" className={styles.searchButton}>
                                Search papers
                            </Link>
                        </div>
                    ) : (
                    <>
                        <div className={styles.allpapers}>
                            {visiblePapers.map((page) => (
                                <SavedPaper
                                    key={`${page.primarySource}-${page.idName}-${page.paperId}`}
                                    page={page}
                                    isLink={true}
                                    deletePaper={deletePaper}
                                />
                            ))}
                        </div>
                        <div className={styles.pagination}>
                            <button
                                className={styles.pagebutton}
                                type="button"
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(prev - 1, 1),
                                    )
                                }
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>

                            <span className={styles.pagenumber}>
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                className={styles.pagebutton}
                                type="button"
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(prev + 1, totalPages),
                                    )
                                }
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </>
                    )
                ) : activeTab === "syntheses" ? (
                    syntheses.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p className={styles.emptyTitle}>No topic syntheses yet</p>
                            <p className={styles.emptyMessage}>
                                Discover analyzes evidence across papers and saves
                                the result here automatically.
                            </p>
                            <Link href="/discover" className={styles.searchButton}>
                                Discover a question
                            </Link>
                        </div>
                    ) : (
                        <div className={styles.libraryList}>
                            {syntheses.map((synthesis) => (
                                <article key={synthesis.id} className={styles.libraryCard}>
                                    <Link href={`/discover?saved=${synthesis.id}`}>
                                        <span className={styles.cardKicker}>Topic synthesis</span>
                                        <h2>{synthesis.question}</h2>
                                        <p>
                                            {formatDate(synthesis.createdAt)} ·{" "}
                                            {synthesis.meta?.papersUsed ??
                                                synthesis.papers?.length ??
                                                0}{" "}
                                            papers
                                        </p>
                                    </Link>
                                    <div className={styles.cardActions}>
                                        <Link href={`/discover?saved=${synthesis.id}`}>
                                            Open synthesis <span aria-hidden="true">→</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => void deleteSynthesis(synthesis)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )
                ) : projects.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyTitle}>No research plans yet</p>
                        <p className={styles.emptyMessage}>
                            Start with Discover, then turn a promising evidence
                            gap into a step-by-step plan.
                        </p>
                        <Link href="/discover" className={styles.searchButton}>
                            Find a research gap
                        </Link>
                    </div>
                ) : (
                    <div className={styles.libraryList}>
                        {projects.map((project) => {
                            const progress = projectProgress(project);
                            return (
                                <article key={project.id} className={styles.libraryCard}>
                                    <Link href={`/projects/${project.id}`}>
                                        <span className={styles.cardKicker}>Research plan</span>
                                        <h2>{project.title}</h2>
                                        <p>
                                            {formatDate(project.createdAt)} ·{" "}
                                            {progress.done}/{progress.total} steps done
                                        </p>
                                    </Link>
                                    <div className={styles.cardActions}>
                                        <Link href={`/projects/${project.id}`}>
                                            Open plan <span aria-hidden="true">→</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => void deleteProject(project)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
        </>
    );
};

export default SavedLibraryClient;
