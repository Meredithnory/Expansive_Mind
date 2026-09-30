"use client";
import React, { useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import styles from "../styles/highlight-actions.module.scss";
import {
    HIGHLIGHT_COLORS,
    MAX_HIGHLIGHTS_PER_PAPER,
    type HighlightColor,
} from "../../lib/paper-highlights";

const COLOR_NAMES: Record<HighlightColor, string> = {
    pink: "Pink",
    blue: "Blue",
    yellow: "Yellow",
};

const DOT_CLASS: Record<HighlightColor, string> = {
    pink: styles.dot_pink,
    blue: styles.dot_blue,
    yellow: styles.dot_yellow,
};

/** Room the bar needs above a highlight before it flips below it. */
const BAR_CLEARANCE = 56;

export interface HighlightActionHandlers {
    color: HighlightColor;
    copied: boolean;
    onColor: (color: HighlightColor) => void;
    onCopy: () => void;
    onAddToChat: () => void;
    onRemove: () => void;
}

const PencilIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20h6M14.5 5.5l4 4L9 19H5v-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

const CopyIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const ChatIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 5h14v10H10l-5 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

const TrashIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/**
 * Desktop: the bar over a highlight, with its color and what to do with it.
 * `anchor` is in the ink layer's coordinates: the highlight's first line
 * (left, top) and the bottom of its last line.
 */
export function HighlightActionBar({
    anchor,
    color,
    copied,
    onColor,
    onCopy,
    onAddToChat,
    onRemove,
}: HighlightActionHandlers & {
    anchor: { left: number; top: number; bottom: number };
}) {
    const barRef = useRef<HTMLDivElement>(null);
    const [flipped, setFlipped] = useState(false);
    const above = !flipped && anchor.top >= BAR_CLEARANCE;

    useLayoutEffect(() => {
        const bar = barRef.current;
        const layer = bar?.closest<HTMLElement>("[data-ink-layer]");
        if (!bar || !layer) return;
        // Keep the bar inside the paper column when a highlight starts near
        // its right edge.
        const width = layer.clientWidth;
        bar.style.maxWidth = `${width}px`;
        const room = width - bar.offsetWidth;
        bar.style.left = `${Math.max(0, Math.min(anchor.left, room))}px`;
        // Above a highlight at the top of the view, the bar would sit under
        // the header or past the pane's edge. Move it below instead.
        if (!above) return;
        const rect = bar.getBoundingClientRect();
        const probe = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + 4,
        );
        if (!probe || !bar.contains(probe)) setFlipped(true);
    }, [anchor.left, anchor.top, anchor.bottom, above]);

    return (
        <div
            ref={barRef}
            className={clsx(styles.bar, above ? styles.barAbove : styles.barBelow)}
            style={{ left: anchor.left, top: above ? anchor.top : anchor.bottom }}
            role="toolbar"
            aria-label="Highlight actions"
            // Keep a click here from moving focus, clearing the reader's
            // selection, or reaching the paper's highlight-on-release handler.
            onMouseDown={(event) => event.preventDefault()}
            onPointerUp={(event) => event.stopPropagation()}
        >
            <div className={styles.barColors} role="group" aria-label="Highlight color">
                {HIGHLIGHT_COLORS.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        className={clsx(styles.barSwatch, {
                            [styles.barSwatchActive]: color === swatch,
                        })}
                        aria-label={`${COLOR_NAMES[swatch]} highlight`}
                        aria-pressed={color === swatch}
                        onClick={() => onColor(swatch)}
                    >
                        <span className={clsx(styles.dot, DOT_CLASS[swatch])} />
                    </button>
                ))}
            </div>
            <span className={styles.barDivider} aria-hidden="true" />
            <button type="button" className={styles.barButton} onClick={onCopy}>
                <CopyIcon size={14} />
                {copied ? "Copied" : "Copy with citation"}
            </button>
            <button
                type="button"
                className={clsx(styles.barButton, styles.barButtonChat)}
                onClick={onAddToChat}
            >
                <ChatIcon size={14} />
                Add to chat
            </button>
            <button
                type="button"
                className={clsx(styles.barButton, styles.barButtonRemove)}
                onClick={onRemove}
            >
                <TrashIcon size={14} />
                Remove
            </button>
        </div>
    );
}

/** Phones: the same actions in a sheet, opened when a highlight is made or tapped. */
/** Marks the open sheet so the reader can keep its highlight in view. */
export const HIGHLIGHT_SHEET_ATTR = "data-highlight-sheet";

/**
 * Phones: scroll so a highlight's lines show between the reader's top bar and
 * the sheet, its first line first when it is too tall to fit. scrollIntoView
 * ignores the ink overlay here, so scroll by the gap.
 */
export function keepAboveSheet(lines: HTMLElement[], sheetHeight: number) {
    if (lines.length === 0) return;
    const rects = lines.map((line) => line.getBoundingClientRect());
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    const topLimit = 96;
    const bottomLimit = window.innerHeight - sheetHeight - 16;
    const delta =
        bottom > bottomLimit
            ? Math.min(bottom - bottomLimit, top - topLimit)
            : top < topLimit
              ? top - topLimit
              : 0;
    if (!delta) return;
    let scroller = lines[0].parentElement;
    while (
        scroller &&
        !(
            /(auto|scroll)/.test(getComputedStyle(scroller).overflowY) &&
            scroller.scrollHeight > scroller.clientHeight
        )
    ) {
        scroller = scroller.parentElement;
    }
    (scroller ?? window).scrollBy({ top: delta, behavior: "smooth" });
}

export function HighlightActionSheet({
    color,
    copied,
    onColor,
    onCopy,
    onAddToChat,
    onRemove,
    sectionTitle,
    saved,
    highlightCount,
    onShowHighlights,
    onClose,
}: HighlightActionHandlers & {
    sectionTitle: string;
    saved: boolean;
    highlightCount: number;
    onShowHighlights?: () => void;
    onClose: () => void;
}) {
    return (
        <section
            className={styles.sheet}
            aria-label="Highlight actions"
            data-highlight-sheet=""
        >
            <span className={styles.sheetGrabber} aria-hidden="true" />
            <div className={styles.sheetHeader}>
                <div className={styles.sheetTitles}>
                    <span className={styles.sheetTitle}>
                        Highlighted in {COLOR_NAMES[color].toLowerCase()}
                    </span>
                    <span className={styles.sheetSubtitle}>
                        {saved ? `${sectionTitle} · saved to this paper` : sectionTitle}
                    </span>
                </div>
                <button
                    type="button"
                    className={styles.sheetClose}
                    aria-label="Close"
                    onClick={onClose}
                >
                    ×
                </button>
            </div>
            <div className={styles.sheetColors} role="group" aria-label="Highlight color">
                {HIGHLIGHT_COLORS.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        className={clsx(styles.sheetSwatch, {
                            [styles.sheetSwatchActive]: color === swatch,
                        })}
                        data-color={swatch}
                        aria-pressed={color === swatch}
                        onClick={() => onColor(swatch)}
                    >
                        <span className={clsx(styles.dot, DOT_CLASS[swatch])} />
                        {COLOR_NAMES[swatch]}
                    </button>
                ))}
            </div>
            <div className={styles.sheetActions}>
                <button type="button" className={styles.sheetAction} onClick={onCopy}>
                    <CopyIcon size={18} />
                    {copied ? "Copied with citation" : "Copy with citation"}
                </button>
                <button
                    type="button"
                    className={clsx(styles.sheetAction, styles.sheetActionChat)}
                    onClick={onAddToChat}
                >
                    <ChatIcon size={18} />
                    Add to chat
                </button>
                <button
                    type="button"
                    className={clsx(styles.sheetAction, styles.sheetActionRemove)}
                    onClick={onRemove}
                >
                    <TrashIcon size={18} />
                    Remove highlight
                </button>
            </div>
            {onShowHighlights && (
                <button
                    type="button"
                    className={styles.sheetListLink}
                    onClick={onShowHighlights}
                >
                    Your highlights · {highlightCount}
                    <span aria-hidden="true">→</span>
                </button>
            )}
        </section>
    );
}

/** Desktop: a line under the title while Highlight is on. */
export function HighlightHint({
    count,
    saved,
}: {
    count: number;
    saved: boolean;
}) {
    return (
        <p className={styles.hint} role="status">
            <PencilIcon />
            <span className={styles.hintText}>
                Highlighting is on. Select a passage to mark it, then pick a color.
            </span>
            {saved && (
                <span className={styles.hintCount}>
                    {count} of {MAX_HIGHLIGHTS_PER_PAPER}
                </span>
            )}
        </p>
    );
}
