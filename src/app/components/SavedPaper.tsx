import React from "react";
import styles from "./styles/savedpaper.module.scss";
import Link from "next/link";
import clsx from "clsx";
import { buildPaperPath, SourceDatabase } from "../lib/paper-sources";

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

const SavedPaper = ({
    page,
    isLink,
    deletePaper,
}: {
    page: Paper;
    isLink: boolean;
    deletePaper: (paper: Paper) => void;
}) => {
    const paperPath = buildPaperPath(page.database, page.paperId, page.idName);
    const openLabel =
        page.canSendToAI === false
            ? "View source"
            : page.accessStatus === "check"
              ? "Open paper"
              : "Open chat";
    const openHref =
        page.canSendToAI === false && page.canonicalUrl
            ? page.canonicalUrl
            : paperPath;
    const opensExternally = page.canSendToAI === false && Boolean(page.canonicalUrl);

    return (
        <article
            className={clsx(styles.card, {
                [styles.springerCard]: page.database === "springer",
                [styles.scholarCard]: page.database === "scholar",
            })}
        >
            <div className={styles.meta}>
                <span
                    className={clsx(styles.sourceTag, {
                        [styles.springerTag]: page.database === "springer",
                        [styles.scholarTag]: page.database === "scholar",
                    })}
                >
                    <span
                        className={clsx(styles.sourceDot, {
                            [styles.springerDot]: page.database === "springer",
                            [styles.scholarDot]: page.database === "scholar",
                        })}
                        aria-hidden="true"
                    />
                    {page.primarySource}
                </span>
                {page.contentLabel ? (
                    <span className={styles.contentLabel}>{page.contentLabel}</span>
                ) : null}
            </div>
            <h3 className={styles.title}>
                <Link href={paperPath}>
                    {typeof page.title === "string" ? page.title : "Untitled"}
                </Link>
            </h3>
            {typeof page.authors === "string" && page.authors ? (
                <p className={styles.authors}>{page.authors}</p>
            ) : null}
            {typeof page.description === "string" && page.description ? (
                <p className={styles.description}>{page.description}</p>
            ) : null}
            {isLink ? (
                <div className={styles.actions}>
                    {opensExternally ? (
                        <a
                            className={styles.primaryAction}
                            href={openHref}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {openLabel} <span aria-hidden="true">↗</span>
                        </a>
                    ) : (
                        <Link className={styles.primaryAction} href={openHref}>
                            {openLabel} <span aria-hidden="true">→</span>
                        </Link>
                    )}
                    <button
                        type="button"
                        className={styles.deleteAction}
                        onClick={() => deletePaper(page)}
                    >
                        Delete
                    </button>
                </div>
            ) : null}
        </article>
    );
};

export default SavedPaper;
