"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { BriefPaperView } from "../../lib/brief-view";
import styles from "./brief.module.scss";

const FIRST = 5;

export default function BriefPaperList({ papers }: { papers: BriefPaperView[] }) {
    const [all, setAll] = useState(papers.length <= FIRST + 1);
    const shown = all ? papers : papers.slice(0, FIRST);
    return (
        <>
            <ol className={styles.paperList}>
                {shown.map((paper) => (
                    <li key={paper.index} id={`paper-${paper.index}`} className={styles.paperRow}>
                        <span className={styles.paperNumber}>{paper.index}</span>
                        <div className={styles.paperBody}>
                            <Link href={paper.href} className={styles.paperTitle}>
                                {paper.title}
                            </Link>
                            {paper.meta ? <span className={styles.paperMeta}>{paper.meta}</span> : null}
                            {paper.scope ? (
                                <span className={styles.paperScope}>
                                    This paper studied {paper.scope}, a narrower group than the question.
                                </span>
                            ) : null}
                        </div>
                        <span
                            className={clsx(styles.paperBadge, {
                                [styles.paperBadgeQuoted]: paper.quoted,
                            })}
                        >
                            {paper.quoted ? "Quoted" : "Link only"}
                        </span>
                    </li>
                ))}
            </ol>
            {!all ? (
                <button type="button" className={styles.textButton} onClick={() => setAll(true)}>
                    Show all {papers.length} papers
                </button>
            ) : null}
        </>
    );
}
