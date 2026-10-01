"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HighlightNotesPaper } from "../lib/highlight-notes";
import type { HighlightColor } from "../lib/paper-highlights";
import { buildPaperFocusHref } from "../lib/paper-sources";
import { CopyIcon, GroupIcon, TrashIcon } from "../components/LibraryIcons";
import { REPLAY_MASK } from "../lib/replay-privacy";
import { matchesLibraryQuery } from "./library-view";
import ShareToGroup from "./ShareToGroup";
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
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(date);
}

/** Highlights grouped by paper. The library loads them so the tab can show a count. */
export default function HighlightsTab({
    papers,
    error,
    query,
    onRetry,
    onRemove,
}: {
    papers: HighlightNotesPaper[] | null;
    error: string;
    query: string;
    onRetry: () => void;
    onRemove: (highlightId: string) => void;
}) {
    const [color, setColor] = useState<HighlightColor | "all">("all");
    const [copiedId, setCopiedId] = useState("");
    const [sharing, setSharing] = useState<{ key: string; highlightId: string } | null>(
        null,
    );

    const all = useMemo(
        () => (papers ?? []).flatMap((paper) => paper.highlights),
        [papers],
    );

    const visible = useMemo(
        () =>
            (papers ?? [])
                .map((paper) => ({
                    ...paper,
                    highlights: paper.highlights.filter(
                        (highlight) =>
                            (color === "all" || highlight.color === color) &&
                            matchesLibraryQuery(query, paper.title, highlight.excerpt),
                    ),
                }))
                .filter((paper) => paper.highlights.length > 0),
        [papers, color, query],
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

    if (error) {
        return (
            <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Highlights unavailable</p>
                <p className={styles.emptyMessage}>{error}</p>
                <button type="button" className={styles.primaryButton} onClick={onRetry}>
                    Try again
                </button>
            </div>
        );
    }

    if (papers === null) {
        return (
            <div className={styles.skeletonList} aria-hidden="true">
                {[0, 1].map((item) => (
                    <div key={item} className={`${styles.skeletonCard} loading-skeleton`} />
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
                <Link href="/searchpaper" className={styles.primaryButton}>
                    Find a paper
                </Link>
            </div>
        );
    }

    return (
        <div className={styles.tabPanel}>
            <div className={styles.chipRow} role="group" aria-label="Filter by color">
                {COLORS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={color === option.id}
                        className={styles.chip}
                        onClick={() => setColor(option.id)}
                    >
                        {option.id !== "all" && (
                            <span
                                className={`${styles.noteSwatch} ${COLOR_CLASS[option.id]}`}
                                aria-hidden="true"
                            />
                        )}
                        {option.label}
                        <span className={styles.chipCount}>
                            {option.id === "all"
                                ? all.length
                                : all.filter((h) => h.color === option.id).length}
                        </span>
                    </button>
                ))}
            </div>
            {visible.length === 0 ? (
                <p className={styles.noMatch}>
                    {query ? "No highlights match that search." : `No ${color} highlights yet.`}
                </p>
            ) : (
                visible.map((paper) => (
                    <article key={paper.key} className={styles.noteCard}>
                        <div className={styles.noteCardHead}>
                            <div>
                                <span className={styles.kicker}>
                                    {paper.primarySource} · {paper.highlights.length}{" "}
                                    {paper.highlights.length === 1 ? "highlight" : "highlights"}
                                </span>
                                <h2>
                                    <Link href={passageHref(paper.href, paper.highlights[0]?.excerpt)}>
                                        {paper.title}
                                    </Link>
                                </h2>
                            </div>
                            <Link
                                href={passageHref(paper.href, paper.highlights[0]?.excerpt)}
                                className={styles.ghostButton}
                            >
                                Open paper <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                        <ol className={styles.noteList} aria-label={`Highlights from ${paper.title}`}>
                            {paper.highlights.map((highlight) => (
                                <li key={highlight.id} className={styles.note}>
                                    <blockquote className={REPLAY_MASK}>
                                        <Link
                                            href={passageHref(paper.href, highlight.excerpt)}
                                            aria-label="Open this highlight in the paper"
                                        >
                                            <mark className={COLOR_CLASS[highlight.color]}>
                                                {highlight.excerpt}
                                            </mark>
                                        </Link>
                                    </blockquote>
                                    <div className={styles.noteMeta}>
                                        <span>
                                            {[
                                                highlight.citation.sectionTitle,
                                                formatDate(highlight.createdAt),
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </span>
                                        <span className={styles.noteActions}>
                                            <button
                                                type="button"
                                                className={
                                                    copiedId === highlight.id
                                                        ? styles.noteCopied
                                                        : undefined
                                                }
                                                onClick={() =>
                                                    void copy(highlight.id, highlight.excerpt)
                                                }
                                            >
                                                <CopyIcon />
                                                {copiedId === highlight.id ? "Copied" : "Copy"}
                                            </button>
                                            <button
                                                type="button"
                                                aria-expanded={
                                                    sharing?.highlightId === highlight.id
                                                }
                                                onClick={() =>
                                                    setSharing((current) =>
                                                        current?.highlightId === highlight.id
                                                            ? null
                                                            : {
                                                                  key: paper.key,
                                                                  highlightId: highlight.id,
                                                              },
                                                    )
                                                }
                                            >
                                                <GroupIcon />
                                                <span className={styles.noteActionText}>
                                                    Send to a group
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.noteDelete}
                                                aria-label="Delete this highlight"
                                                onClick={() => onRemove(highlight.id)}
                                            >
                                                <TrashIcon size={14} />
                                            </button>
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        {sharing?.key === paper.key && (
                            <ShareToGroup
                                key={sharing.highlightId}
                                // Share from the full paper, not a filtered view.
                                paper={papers.find((item) => item.key === paper.key) ?? paper}
                                initialHighlightIds={[sharing.highlightId]}
                                onClose={() => setSharing(null)}
                            />
                        )}
                    </article>
                ))
            )}
        </div>
    );
}
