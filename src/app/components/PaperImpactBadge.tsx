"use client";

import clsx from "clsx";
import {
    citationCredibilityNote,
    citationPopularity,
    formatCitationCount,
    parseCitationCount,
    type CitationSource,
} from "../lib/paper-impact";
import styles from "./styles/paper-impact.module.scss";

type PaperImpactBadgeProps = {
    citationCount?: number | null;
    citationSource?: CitationSource;
    className?: string;
};

export default function PaperImpactBadge({
    citationCount,
    citationSource,
    className,
}: PaperImpactBadgeProps) {
    const count = parseCitationCount(citationCount);
    if (count == null) return null;

    const popularity = citationPopularity(count);

    return (
        <span
            className={clsx(styles.badge, styles[popularity.level], className)}
            title={citationCredibilityNote(citationSource)}
            aria-label={`${formatCitationCount(count)}. ${popularity.label}. ${citationCredibilityNote(citationSource)}`}
        >
            <span className={styles.count}>{formatCitationCount(count)}</span>
            <span className={styles.popularity}>{popularity.label}</span>
        </span>
    );
}
