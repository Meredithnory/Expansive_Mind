"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { HighlightNotesPaper } from "../lib/highlight-notes";
import type { HighlightColor } from "../lib/paper-highlights";
import { buildPaperFocusHref } from "../lib/paper-sources";
import styles from "./savedpage.module.scss";

const COLORS: Array<{ id: HighlightColor | "all"; label: string }> = [
    { id: "all", label: "All" },
    { id: "pink", label: "Pink" },
    { id: "blue", label: "Blue" },
    { id: "yellow", label: "Yellow" },
];

const COLOR_CLASS: Record<HighlightColor, string> = {
    pink: styles.notePink,
    blue: styles.noteBlue,
    yellow: styles.noteYellow,
};

// Opens the paper scrolled to (and marking) this passage.
function passageHref(href: string, excerpt?: string) {
    return buildPaperFocusHref(href, excerpt, { method: false });
}

function formatDate(value?: string) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value));
}

export default function HighlightsTab({
    onCount,
}: {
    onCount: (count: number) => void;
}) {
    const [papers, setPapers] = useState<HighlightNotesPaper[] | null>(null);
    const [error, setError] = useState("");
    const [color, setColor] = useState<HighlightColor | "all">("all");
    const [copiedId, setCopiedId] = useState("");

    const load = useCallback(async () => {
        setError("");
        try {
            const response = await fetch("/api/highlights/all", {
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Highlights could not be loaded.");
            }
            setPapers(Array.isArray(data.papers) ? data.papers : []);
            onCount(typeof data.total === "number" ? data.total : 0);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Highlights could not be loaded.",
            );
        }
    }, [onCount]);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = useMemo(
        () =>
            (papers ?? [])
                .map((paper) => ({
                    ...paper,
                    highlights:
                        color === "all"
                            ? paper.highlights
                            : paper.highlights.filter((h) => h.color === color),
                }))
                .filter((paper) => paper.highlights.length > 0),
        [papers, color],
    );

    async function copy(id: string, text: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            window.setTimeout(() => setCopiedId(""), 1600);
        } catch {
            setCopiedId("");
        }
    }

    async function remove(id: string) {
        const previous = papers;
        const next = (papers ?? [])
            .map((paper) => ({
                ...paper,
                highlights: paper.highlights.filter((h) => h.id !== id),
            }))
            .filter((paper) => paper.highlights.length > 0);
        setPapers(next);
        onCount(next.reduce((sum, paper) => sum + paper.highlights.length, 0));
        const response = await fetch("/api/highlights", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ highlightId: id }),
        });
        if (!response.ok) {
            setPapers(previous);
            void load();
        }
    }

    if (error) {
        return (
            <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Highlights unavailable</p>
                <p className={styles.emptyMessage}>{error}</p>
                <button className={styles.searchButton} onClick={() => void load()}>
                    Try again
                </button>
            </div>
        );
    }

    if (papers === null) {
        return (
            <div className={styles.savedPapersSkeleton} aria-hidden="true">
                {[0, 1, 2].map((item) => (
                    <div
                        key={item}
                        className={`${styles.savedPaperSkeletonCard} loading-skeleton`}
                    />
                ))}
            </div>
        );
    }

    if (papers.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No highlights yet</p>
                <p className={styles.emptyMessage}>
                    Open a paper, tap Highlight, and select the lines you want
                    to keep. They collect here, grouped by paper.
                </p>
                <Link href="/searchpaper" className={styles.searchButton}>
                    Find a paper
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className={styles.noteFilters} role="group" aria-label="Filter by color">
                {COLORS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={color === option.id}
                        className={color === option.id ? styles.noteFilterActive : ""}
                        onClick={() => setColor(option.id)}
                    >
                        {option.id !== "all" && (
                            <span
                                className={`${styles.noteSwatch} ${COLOR_CLASS[option.id]}`}
                                aria-hidden="true"
                            />
                        )}
                        {option.label}
                    </button>
                ))}
            </div>
            {visible.length === 0 ? (
                <p className={styles.emptyMessage}>No {color} highlights yet.</p>
            ) : (
                <div className={`${styles.libraryList} ${styles.noteColumns}`}>
                    {visible.map((paper) => (
                        <article key={paper.key} className={styles.libraryCard}>
                            <Link href={passageHref(paper.href, paper.highlights[0]?.excerpt)}>
                                <span className={styles.cardKicker}>
                                    {paper.primarySource} · {paper.highlights.length}{" "}
                                    {paper.highlights.length === 1 ? "highlight" : "highlights"}
                                </span>
                                <h2>{paper.title}</h2>
                            </Link>
                            <ol className={styles.noteList}>
                                {paper.highlights.map((highlight) => (
                                    <li
                                        key={highlight.id}
                                        className={`${styles.note} ${COLOR_CLASS[highlight.color]}`}
                                    >
                                        <Link
                                            href={passageHref(paper.href, highlight.excerpt)}
                                            className={styles.noteLink}
                                            aria-label="Open this highlight in the paper"
                                        >
                                            <blockquote>{highlight.excerpt}</blockquote>
                                        </Link>
                                        <div className={styles.noteMeta}>
                                            <span>
                                                {highlight.citation.sectionTitle}
                                                {highlight.createdAt
                                                    ? ` · ${formatDate(highlight.createdAt)}`
                                                    : ""}
                                            </span>
                                            <span className={styles.noteActions}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void copy(highlight.id, highlight.excerpt)
                                                    }
                                                >
                                                    {copiedId === highlight.id ? "Copied" : "Copy"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void remove(highlight.id)}
                                                >
                                                    Delete
                                                </button>
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                            <div className={styles.cardActions}>
                                <Link href={passageHref(paper.href, paper.highlights[0]?.excerpt)}>
                                    Open paper <span aria-hidden="true">→</span>
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </>
    );
}
