"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { FormattedPaper } from "../../api/general-interfaces";
import styles from "../styles/paper-contents.module.scss";

/** Section titles authors use for a short "why this matters" summary. */
const SUMMARY_TITLE = /^(significance( statement)?|highlights|key points|key messages|key findings|research in context)$/i;

/** Collapsed height, roughly four lines of the card's text. */
const COLLAPSED_PX = 104;

export function findSignificanceSection(paper: FormattedPaper) {
    const section = paper.paper.find((item) => SUMMARY_TITLE.test(item.title?.trim() || ""));
    if (!section) return null;
    const paragraphs = [section.content, ...section.subSections.map((sub) => sub.content)]
        .filter(Boolean)
        .flatMap((block) => block.split(/\n\s*\n/))
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter(Boolean);
    const text = paragraphs.join(" ");
    return text ? { title: section.title.trim(), text, paragraphs } : null;
}

/** The summary as a handful of bullet points: the paper's own paragraphs,
 * else its sentences. Returns null when it doesn't read as separate points. */
export function significancePoints(
    text: string,
    paragraphs: string[] = [],
): string[] | null {
    if (paragraphs.length >= 2 && paragraphs.length <= 6) return paragraphs;
    const points = text
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map((point) => point.trim())
        .filter(Boolean);
    // An abbreviation such as "et al." or "Fig." ends a sentence falsely.
    const falseBreak = points.some((point, index) =>
        index < points.length - 1 && /\b(?:al|Fig|Figs|e\.g|i\.e|vs|No|approx)\.$/.test(point),
    );
    if (falseBreak || points.length < 2 || points.length > 6) return null;
    return points;
}

const SparkleIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

/** The paper's own Significance / Highlights section, surfaced at the top. */
export default function PaperSignificance({
    paper,
    onJump,
    onSummarize,
}: {
    paper: FormattedPaper;
    onJump: (sectionTitle: string) => void;
    /** Asks the assistant for a summary; hidden when chat is unavailable. */
    onSummarize?: () => void;
}) {
    const found = findSignificanceSection(paper);
    const textRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [fullHeight, setFullHeight] = useState(0);

    useLayoutEffect(() => {
        if (textRef.current) setFullHeight(textRef.current.scrollHeight);
    }, [found?.text]);

    if (!found) return null;
    const needsToggle = fullHeight > COLLAPSED_PX + 8;
    const points = significancePoints(found.text, found.paragraphs);

    return (
        <section className={styles.significance} aria-label={found.title}>
            <div className={styles.significanceHead}>
                <span className={styles.significanceLabel}>{found.title} · from the paper</span>
                {onSummarize && (
                    <button type="button" className={styles.summarize} onClick={onSummarize}>
                        <SparkleIcon />
                        Summarize this paper
                    </button>
                )}
            </div>
            <div
                ref={textRef}
                className={styles.significanceText}
                style={{ maxHeight: expanded || !needsToggle ? fullHeight || undefined : COLLAPSED_PX }}
            >
                {points ? (
                    <ul>
                        {points.map((point) => (
                            <li key={point}>{point}</li>
                        ))}
                    </ul>
                ) : (
                    <p>{found.text}</p>
                )}
            </div>
            <div className={styles.significanceActions}>
                {needsToggle && (
                    <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                        {expanded ? "Show less" : "Show more"}
                    </button>
                )}
                <button type="button" onClick={() => onJump(found.title)}>
                    Go to section
                </button>
            </div>
        </section>
    );
}
