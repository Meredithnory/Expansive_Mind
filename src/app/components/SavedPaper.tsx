"use client";

import React, { useRef } from "react";
import styles from "./styles/savedpaper.module.scss";
import Link from "next/link";
import clsx from "clsx";
import { buildPaperPath, SourceDatabase } from "../lib/paper-sources";
import { paperAccessLabel, paperOpenLabel } from "../savedpapers/library-view";
import { ArrowRightIcon, ShareIcon, TrashIcon } from "./LibraryIcons";

export interface Paper {
    title: string;
    authors: string;
    description: string;
    paperId: string;
    idName: string;
    primarySource: string;
    database: SourceDatabase;
    canonicalUrl?: string;
    accessStatus?: "available" | "restricted" | "check";
    canSendToAI?: boolean | null;
    contentLabel?: "Abstract" | "Search snippet";
}

function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

function isModifiedClick(event: React.MouseEvent) {
    return (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
    );
}

/** One saved paper in the Research Library list. */
const SavedPaper = ({
    page,
    topic,
    deletePaper,
    onShare,
}: {
    page: Paper;
    topic?: string;
    deletePaper: (paper: Paper) => void;
    onShare?: (paper: Paper) => void;
}) => {
    const cardRef = useRef<HTMLElement>(null);
    const paperPath = buildPaperPath(page.database, page.paperId, page.idName);
    const title = typeof page.title === "string" ? page.title : "Untitled";
    const openLabel = paperOpenLabel(page);
    const access = paperAccessLabel(page);
    const opensExternally = page.canSendToAI === false && Boolean(page.canonicalUrl);

    /** Flash a quick fade; never delay navigation. */
    const flashExit = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (isModifiedClick(event) || prefersReducedMotion()) return;
        cardRef.current?.classList.add(styles.exiting);
    };

    return (
        <article ref={cardRef} className={styles.row}>
            <div className={styles.main}>
                <p className={styles.meta}>
                    <span
                        className={clsx(styles.sourceDot, {
                            [styles.springerDot]: page.database === "springer",
                            [styles.scholarDot]: page.database === "scholar",
                        })}
                        aria-hidden="true"
                    />
                    {page.primarySource}
                    {topic ? <span className={styles.topic}> · {topic}</span> : null}
                </p>
                <h3 className={styles.title}>
                    <Link href={paperPath} onClick={flashExit}>
                        {title}
                    </Link>
                </h3>
                {typeof page.authors === "string" && page.authors ? (
                    <p className={styles.authors}>{page.authors}</p>
                ) : null}
            </div>
            <div className={styles.actions}>
                {access ? (
                    <span
                        className={clsx(styles.access, {
                            [styles.fullText]: access === "Full text",
                        })}
                    >
                        {access}
                    </span>
                ) : null}
                {onShare ? (
                    <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Share ${title}`}
                        onClick={() => onShare(page)}
                    >
                        <ShareIcon size={15} />
                    </button>
                ) : null}
                <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Remove ${title} from your library`}
                    onClick={() => deletePaper(page)}
                >
                    <TrashIcon size={15} />
                </button>
                {opensExternally ? (
                    <a
                        className={styles.openAction}
                        href={page.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${openLabel}: ${title} (opens in a new tab)`}
                    >
                        <span className={styles.openText}>{openLabel}</span>
                        <span className={styles.openArrow} aria-hidden="true">↗</span>
                    </a>
                ) : (
                    <Link
                        className={styles.openAction}
                        href={paperPath}
                        onClick={flashExit}
                        aria-label={`${openLabel}: ${title}`}
                    >
                        <span className={styles.openText}>{openLabel}</span>
                        <span className={styles.openArrow} aria-hidden="true">
                            <ArrowRightIcon size={15} />
                        </span>
                    </Link>
                )}
            </div>
        </article>
    );
};

export default SavedPaper;
