"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import styles from "../styles/paper-contents.module.scss";

/** The scrolling element for the paper: its own pane on desktop, the window on phones. */
function scrollerOf(pane: HTMLElement | null): HTMLElement | null {
    if (!pane) return null;
    const { overflowY } = getComputedStyle(pane);
    return (overflowY === "auto" || overflowY === "scroll") &&
        pane.scrollHeight > pane.clientHeight
        ? pane
        : null;
}

/**
 * The paper's contents: a rail beside the paper on wide screens, and a
 * sticky bar with a menu that unrolls from the top everywhere else. Both
 * show the current section and how far you've read.
 */
export default function PaperContents({
    sections,
    paneRef,
    figureCount = 0,
    highlightCount = 0,
    onShowFigures,
    onShowHighlights,
}: {
    sections: string[];
    paneRef: RefObject<HTMLElement | null>;
    figureCount?: number;
    highlightCount?: number;
    onShowFigures?: () => void;
    onShowHighlights?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState(sections[0] ?? "");
    const [progress, setProgress] = useState(0);
    const wrapRef = useRef<HTMLDivElement>(null);

    const measure = useCallback(() => {
        const pane = paneRef.current;
        if (!pane) return;
        const scroller = scrollerOf(pane);
        const top = scroller ? scroller.getBoundingClientRect().top : 0;
        const viewport = scroller ? scroller.clientHeight : window.innerHeight;
        const scrolled = scroller ? scroller.scrollTop : Math.max(0, -pane.getBoundingClientRect().top);
        const total = (scroller ? scroller.scrollHeight : pane.scrollHeight) - viewport;
        setProgress(total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 1);

        // The section whose heading most recently passed the reading line.
        const line = top + Math.min(160, viewport * 0.3);
        let active = sections[0] ?? "";
        pane.querySelectorAll<HTMLElement>("[data-section-title]").forEach((node) => {
            if (node.getBoundingClientRect().top <= line) {
                active = node.dataset.sectionTitle || active;
            }
        });
        setCurrent(active);
    }, [paneRef, sections]);

    useEffect(() => {
        const pane = paneRef.current;
        if (!pane) return;
        let frame = 0;
        const onScroll = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(measure);
        };
        measure();
        pane.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.cancelAnimationFrame(frame);
            pane.removeEventListener("scroll", onScroll);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [paneRef, measure]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const jumpTo = (title: string) => {
        setOpen(false);
        const target = paneRef.current?.querySelector<HTMLElement>(
            `[data-section-title="${CSS.escape(title)}"]`,
        );
        target?.scrollIntoView({ block: "start", behavior: "smooth" });
    };

    if (sections.length < 2) return null;
    const percent = Math.round(progress * 100);
    const currentIndex = sections.indexOf(current);

    return (
        <>
        <nav aria-label="Contents" className={styles.rail}>
            <span className={styles.railLabel}>Contents</span>
            <div className={styles.railProgress}>
                <span className={styles.railTrack} aria-hidden="true">
                    <span className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
                </span>
                <span className={styles.railPercent}>{percent}% read</span>
            </div>
            <ol className={styles.railList}>
                {sections.map((title, index) => (
                    <li key={`${title}-${index}`}>
                        <button
                            type="button"
                            className={
                                title === current
                                    ? styles.railItemActive
                                    : index < currentIndex
                                      ? styles.railItemRead
                                      : styles.railItem
                            }
                            aria-current={title === current ? "true" : undefined}
                            onClick={() => jumpTo(title)}
                        >
                            <span className={styles.railNumber}>{index + 1}</span>
                            {title}
                        </button>
                    </li>
                ))}
            </ol>
            {(figureCount > 0 || highlightCount > 0) && (
                <div className={styles.railExtras}>
                    {figureCount > 0 && (
                        <button type="button" onClick={onShowFigures}>
                            Figures · {figureCount}
                        </button>
                    )}
                    {highlightCount > 0 && onShowHighlights && (
                        <button type="button" onClick={onShowHighlights}>
                            Your highlights · {highlightCount}
                        </button>
                    )}
                </div>
            )}
        </nav>
        <div ref={wrapRef} className={styles.bar}>
            <div className={styles.row}>
                <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={open}
                    aria-controls="paper-contents-menu"
                    onClick={() => setOpen((value) => !value)}
                >
                    Contents
                    <span className={open ? styles.chevronOpen : styles.chevron} aria-hidden="true" />
                </button>
                <span className={styles.current} aria-live="polite">
                    {current}
                </span>
                <span className={styles.percent}>{percent}% read</span>
            </div>
            <div className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
            </div>
            <nav
                id="paper-contents-menu"
                aria-label="Paper contents"
                className={open ? styles.menuOpen : styles.menu}
                inert={!open}
            >
                <ol>
                    {sections.map((title, index) => (
                        <li key={`${title}-${index}`}>
                            <button
                                type="button"
                                className={title === current ? styles.itemActive : styles.item}
                                aria-current={title === current ? "true" : undefined}
                                onClick={() => jumpTo(title)}
                            >
                                <span className={styles.itemNumber}>{index + 1}</span>
                                {title}
                            </button>
                        </li>
                    ))}
                </ol>
            </nav>
        </div>
        </>
    );
}
