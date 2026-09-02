"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import pageStyles from "./discover.module.scss";
import styles from "./paper-preview-drawer.module.scss";
import type { PaperExtraction } from "../api/discover/report-types";
import {
    evidenceTypeLabel,
    publicationYear,
} from "../lib/evidence-type";
import { buildPaperFocusHref } from "../lib/paper-sources";

export type PreviewPaper = {
    index: number;
    database: "nih" | "springer" | "scholar";
    title: string;
    authors: string[];
    date: string;
    sourceLabel: string;
    sourceUrl: string;
    href: string;
    doi?: string;
};

type PaperPreviewDrawerProps = {
    paper: PreviewPaper | null;
    papers: PreviewPaper[];
    extraction?: PaperExtraction | null;
    onClose: () => void;
    onSelectPaper: (index: number) => void;
    onSeeInSources?: (index: number) => void;
};

function sourceBadgeClass(database: PreviewPaper["database"]) {
    if (database === "springer") return pageStyles.springerBadge;
    if (database === "scholar") return pageStyles.scholarBadge;
    return pageStyles.nihBadge;
}

function evidenceBadgeClass(type: string | undefined) {
    if (type === "rct" || type === "observational") {
        return pageStyles.evidenceClinical;
    }
    if (type === "review") return pageStyles.evidenceReview;
    if (type === "in-vitro" || type === "animal") {
        return pageStyles.evidencePreclinical;
    }
    if (type === "computational") return pageStyles.evidenceComputational;
    return pageStyles.evidenceOther;
}

function formatAuthors(authors: string[]) {
    if (authors.length === 0) return "";
    const shown = authors.slice(0, 3).join(", ");
    return authors.length > 3 ? `${shown} et al.` : shown;
}

function doiHref(doi: string) {
    const normalized = doi
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/doi\.org\//i, "");
    return `https://doi.org/${normalized}`;
}

function doiLabel(doi: string) {
    return doi
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/doi\.org\//i, "");
}

export default function PaperPreviewDrawer({
    paper,
    papers,
    extraction,
    onClose,
    onSelectPaper,
    onSeeInSources,
}: PaperPreviewDrawerProps) {
    const panelRef = useRef<HTMLElement>(null);
    const titleId = useId();
    const [mounted, setMounted] = useState(false);
    const open = Boolean(paper);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!mounted || !paper) return null;

    const position = papers.findIndex((item) => item.index === paper.index);
    const prevPaper = position > 0 ? papers[position - 1] : null;
    const nextPaper =
        position >= 0 && position < papers.length - 1
            ? papers[position + 1]
            : null;
    const authors = formatAuthors(paper.authors);
    const paperLabel = `Paper ${String(paper.index).padStart(2, "0")}`;
    const year =
        publicationYear(paper.date) ||
        publicationYear(extraction?.publicationDate);
    const evidenceType = extraction?.evidenceType;
    const hasEvidence =
        Boolean(extraction?.supportingExcerpt) ||
        Boolean(extraction && extraction.keyFindings.length > 0) ||
        Boolean(extraction?.methods) ||
        Boolean(extraction && extraction.limitations.length > 0);
    const methodExcerpt =
        extraction?.methods || extraction?.supportingExcerpt || "";
    const methodHref = buildPaperFocusHref(paper.href, methodExcerpt);

    return createPortal(
        <div className={styles.overlay}>
            <aside
                ref={panelRef}
                className={styles.drawer}
                role="dialog"
                aria-modal="false"
                aria-labelledby={titleId}
            >
                <div className={styles.dragHandle} aria-hidden="true" />
                <header className={styles.header}>
                    <div className={styles.headerMeta}>
                        <span className={styles.paperLabel}>{paperLabel}</span>
                        <span
                            className={clsx(
                                pageStyles.sourceBadge,
                                sourceBadgeClass(paper.database),
                            )}
                        >
                            {paper.sourceLabel}
                        </span>
                        {year ? (
                            <span className={styles.yearChip}>{year}</span>
                        ) : null}
                        {evidenceType ? (
                            <span
                                className={clsx(
                                    pageStyles.evidenceBadge,
                                    evidenceBadgeClass(evidenceType),
                                )}
                            >
                                {evidenceTypeLabel(evidenceType)}
                            </span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        aria-label="Close paper preview"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <div key={paper.index} className={styles.body}>
                    <h2 id={titleId} className={styles.title}>
                        {paper.title || "Untitled paper"}
                    </h2>
                    {(authors || paper.date) && (
                        <p className={styles.meta}>
                            {authors}
                            {authors && paper.date ? " · " : ""}
                            {paper.date}
                        </p>
                    )}
                    {paper.doi && (
                        <a
                            href={doiHref(paper.doi)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.doi}
                        >
                            DOI {doiLabel(paper.doi)}
                        </a>
                    )}

                    {hasEvidence ? (
                        <section
                            className={styles.evidence}
                            aria-label="Evidence used in this report"
                        >
                            <p className={styles.evidenceKicker}>
                                Evidence used in this report
                            </p>
                            {extraction?.supportingExcerpt ? (
                                <blockquote className={styles.excerpt}>
                                    {extraction.supportingExcerpt}
                                </blockquote>
                            ) : null}
                            {extraction && extraction.keyFindings.length > 0 ? (
                                <div className={styles.evidenceBlock}>
                                    <h3>Findings used</h3>
                                    <ul>
                                        {extraction.keyFindings.map(
                                            (finding, index) => (
                                                <li
                                                    key={`${paper.index}-finding-${index}`}
                                                >
                                                    {finding}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                            ) : null}
                            {extraction?.methods ? (
                                <div className={styles.evidenceBlock}>
                                    <h3>Methods</h3>
                                    <p>{extraction.methods}</p>
                                </div>
                            ) : null}
                            {extraction &&
                            extraction.limitations.length > 0 ? (
                                <div className={styles.evidenceBlock}>
                                    <h3>Limitations</h3>
                                    <ul>
                                        {extraction.limitations.map(
                                            (item, index) => (
                                                <li
                                                    key={`${paper.index}-limit-${index}`}
                                                >
                                                    {item}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                            ) : null}
                        </section>
                    ) : (
                        <p className={styles.missingEvidence}>
                            Findings for this paper were not saved with this
                            run. Open the paper to read the licensed source.
                        </p>
                    )}

                    <div className={styles.actions}>
                        <Link
                            href={methodHref}
                            className={styles.primaryAction}
                        >
                            Show method in paper{" "}
                            <span aria-hidden="true">→</span>
                        </Link>
                        <Link
                            href={paper.href}
                            className={styles.secondaryAction}
                        >
                            Open paper
                        </Link>
                        {paper.sourceUrl && (
                            <a
                                href={paper.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.secondaryAction}
                            >
                                View source ↗
                            </a>
                        )}
                    </div>

                    {onSeeInSources && (
                        <button
                            type="button"
                            className={styles.seeInSources}
                            onClick={() => onSeeInSources(paper.index)}
                        >
                            See in sources list
                        </button>
                    )}
                </div>

                {papers.length > 1 && (
                    <nav
                        className={styles.pager}
                        aria-label="Other papers in this report"
                    >
                        {prevPaper ? (
                            <button
                                type="button"
                                className={styles.pagerButton}
                                onClick={() => onSelectPaper(prevPaper.index)}
                            >
                                <span aria-hidden="true">←</span>
                                {`Paper ${String(prevPaper.index).padStart(2, "0")}`}
                            </button>
                        ) : (
                            <span />
                        )}
                        {nextPaper ? (
                            <button
                                type="button"
                                className={styles.pagerButton}
                                onClick={() => onSelectPaper(nextPaper.index)}
                            >
                                {`Paper ${String(nextPaper.index).padStart(2, "0")}`}
                                <span aria-hidden="true">→</span>
                            </button>
                        ) : (
                            <span />
                        )}
                    </nav>
                )}
            </aside>
        </div>,
        document.body,
    );
}
