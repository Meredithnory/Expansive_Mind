"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../styles/paperbox.module.scss";
import clsx from "clsx";
import {
    FormattedPaper,
    PaperFigure,
    Section as SectionInterface,
    SubSection as SubSectionInterface,
} from "../../api/general-interfaces";
import Image from "next/image";
import { HighlightSearchTitle } from "../../lib/highlight-search";
import { formatQuoteWithCitation } from "../../lib/quote-citation";
import PaperContents from "./PaperContents";
import PaperSignificance from "./PaperSignificance";
import PaperAuthors from "./PaperAuthors";
import {
    HIGHLIGHT_SHEET_ATTR,
    HighlightActionBar,
    HighlightActionSheet,
    HighlightHint,
    keepAboveSheet,
    type HighlightActionHandlers,
} from "./HighlightActions";
import { scrollRangeIntoView } from "../../lib/scroll-to-range";
import type { PaperCitation } from "../../lib/paper-citation";
import {
    citationLabel,
    locateExcerptInPaper,
    locateQuoteInPaper,
    locateMethodInPaper,
} from "../../lib/paper-citation";
import {
    findExcerptRange,
    selectedTextFromRange,
    selectionRectsRelativeTo,
    type PaperTool,
} from "../../lib/region-capture";
import {
    isSyntheticMouseAfterTouch,
} from "../../lib/highlight-gesture";
import {
    DEFAULT_HIGHLIGHT_COLOR,
    deletePaperHighlight,
    fetchPaperHighlights,
    type HighlightColor,
    parseHighlightColor,
    type PaperHighlightRecord,
    savePaperHighlight,
    updatePaperHighlightColor,
} from "../../lib/paper-highlights";
import PaperImpactBadge from "../PaperImpactBadge";

const AGENT_HIGHLIGHT = "agent-focus";
const AGENT_HIGHLIGHT_STYLE_ID = "agent-focus-highlight-style";

const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
    pink: "Pink highlight",
    blue: "Blue highlight",
    yellow: "Yellow highlight",
};

const INK_COLOR_CLASS: Record<HighlightColor, string> = {
    pink: styles.inkColor_pink,
    blue: styles.inkColor_blue,
    yellow: styles.inkColor_yellow,
};

/** "2026-09-07" → "Sep 7, 2026"; anything else is shown as given. */
const formatPaperDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
          }).format(date);
};

/** JATS article-type values worth a chip; anything else shows none. */
const ARTICLE_TYPE_LABELS: Record<string, string> = {
    "review-article": "Review",
    "systematic-review": "Systematic review",
    "meta-analysis": "Meta-analysis",
    "research-article": "Research article",
    "brief-report": "Brief report",
    "case-report": "Case report",
    "rapid-communication": "Rapid communication",
    editorial: "Editorial",
    letter: "Letter",
    commentary: "Commentary",
    protocol: "Protocol",
};

const ensureAgentHighlightStyle = () => {
    if (typeof document === "undefined") return;
    if (document.getElementById(AGENT_HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = AGENT_HIGHLIGHT_STYLE_ID;
    style.textContent =
        // The cited passage: theme pink with a brighter underline, white text.
        "::highlight(agent-focus){color:#fff;background-color:rgba(255,61,154,.42);text-decoration:underline 2px #ff8ec4;text-underline-offset:4px}";
    document.head.appendChild(style);
};

const cssHighlights = () => {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return null;
    return CSS.highlights;
};

const setAgentTextHighlight = (range: Range | null) => {
    const highlights = cssHighlights();
    if (!highlights) return false;
    if (!range) {
        highlights.delete(AGENT_HIGHLIGHT);
        return false;
    }
    ensureAgentHighlightStyle();
    highlights.set(AGENT_HIGHLIGHT, new Highlight(range));
    return true;
};

const getTitleHighlightClass = (source?: string) => {
    if (source === "springer") return styles.natureHighlight;
    if (source === "scholar") return styles.scholarHighlight;
    return styles.nihHighlight;
};

interface PaperBoxProps {
    paper: FormattedPaper | null;
    /** Body is loading in the reader's browser from PubMed Central. */
    browserBodyLoading?: boolean;
    searchTerm: string | null;
    isPro: boolean;
    activeTool?: PaperTool | null;
    persistHighlights?: {
        database: string;
        paperId: string;
        idName: string;
    } | null;
    onAnalyzeFigure: (figure: PaperFigure) => void;
    onHighlight?: (citation: PaperCitation) => void;
    /** Receives the reader's highlights whenever they change. */
    onMarksChange?: (marks: PaperHighlightRecord[]) => void;
    /** Asks the assistant to summarize the paper. */
    onSummarize?: () => void;
    /** Opens the assistant's Highlights tab. */
    onShowHighlights?: () => void;
    focusExcerpt?: string | null;
    locateMethod?: boolean;
    focusCitation?: PaperCitation | null;
    focusRequestId?: number;
}

interface InkRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface InkMark {
    id: string;
    serverId?: string;
    excerpt: string;
    rects: InkRect[];
    citation: PaperCitation;
    color: HighlightColor;
}

const rectsMatch = (left: InkRect[], right: InkRect[]) =>
    left.length === right.length &&
    left.every(
        (rect, index) =>
            rect.left === right[index].left &&
            rect.top === right[index].top &&
            rect.width === right[index].width &&
            rect.height === right[index].height,
    );

const measureExcerptRects = (root: HTMLElement, excerpt: string) => {
    const range = findExcerptRange(root, excerpt);
    if (!range) return [] as InkRect[];
    return selectionRectsRelativeTo(range, root);
};

/** A figure the reader shows: it has an image, a caption, or a label. */
const isShownFigure = (figure: PaperFigure) =>
    Boolean(
        (figure.imageUrl && (figure.canAnalyzeSourceImage || figure.displayOnly)) ||
            figure.caption ||
            figure.label ||
            figure.captionTitle,
    );

const FigureList = ({
    figures,
    isPro,
    onAnalyzeFigure,
}: {
    figures?: PaperFigure[];
    isPro: boolean;
    onAnalyzeFigure: (figure: PaperFigure) => void;
}) =>
    figures?.map((figure) => {
        const title = [figure.label, figure.captionTitle]
            .filter(Boolean)
            .join(". ");
        const canAnalyze = Boolean(
            figure.imageUrl && figure.canAnalyzeSourceImage,
        );
        const hasImage = canAnalyze || Boolean(figure.imageUrl && figure.displayOnly);
        // Caption-only figures: short label/caption, no empty image hole.
        // Skip entirely when the source has neither caption nor analyzable image.
        if (!isShownFigure(figure)) {
            return null;
        }
        return (
            <figure
                className={clsx(
                    styles.graphicSection,
                    !hasImage && styles.graphicCaptionOnly,
                )}
                key={figure.id}
            >
                {hasImage && (
                    <div className={styles.figureImage}>
                        <Image
                            src={figure.imageUrl!}
                            alt={title || "Research paper figure"}
                            fill
                            unoptimized
                            style={{ objectFit: "contain" }}
                            sizes="(max-width: 768px) 100vw, 800px"
                        />
                    </div>
                )}
                <figcaption className={styles.figureCaption}>
                    <span>
                        {title && <strong>{title}</strong>}
                        {title && figure.caption ? " " : null}
                        {figure.caption}
                    </span>
                    {canAnalyze && (
                        <button
                            type="button"
                            className={styles.figureAsk}
                            disabled={!isPro}
                            onClick={() => onAnalyzeFigure(figure)}
                            aria-label={`Ask about ${figure.label || "this figure"}`}
                        >
                            {isPro
                                ? "Ask about this figure"
                                : "Pro: Ask about this figure"}
                        </button>
                    )}
                </figcaption>
            </figure>
        );
    }) || null;

const SubSection = ({
    subSection,
    isPro,
    onAnalyzeFigure,
}: {
    subSection: SubSectionInterface;
    isPro: boolean;
    onAnalyzeFigure: (figure: PaperFigure) => void;
}) => {
    return (
        <>
            {subSection && (
                <div className={styles.subsection}>
                    {subSection.title && <h6>{subSection.title}</h6>}
                    {subSection.content && <p>{subSection.content}</p>}
                    <FigureList
                        figures={subSection.figures}
                        isPro={isPro}
                        onAnalyzeFigure={onAnalyzeFigure}
                    />
                </div>
            )}
        </>
    );
};

const Section = ({
    section,
    number,
    isPro,
    onAnalyzeFigure,
}: {
    section: SectionInterface;
    /** Its place in Contents, shown before the heading. */
    number?: number;
    isPro: boolean;
    onAnalyzeFigure: (figure: PaperFigure) => void;
}) => {
    return (
        <div className={styles.section} data-section-title={section.title || "Paper"}>
            {section.title && (
                <h4>
                    {number ? (
                        <span className={styles.sectionNumber}>{number} </span>
                    ) : null}
                    {section.title}
                </h4>
            )}
            {section.content && <p>{section.content}</p>}
            <FigureList
                figures={section.figures}
                isPro={isPro}
                onAnalyzeFigure={onAnalyzeFigure}
            />
            <div className={styles.subSectionWrap}>
                {section.subSections.map((subSection, index) => (
                    <SubSection
                        subSection={subSection}
                        key={`${subSection.title || "subsection"}-${index}`}
                        isPro={isPro}
                        onAnalyzeFigure={onAnalyzeFigure}
                    />
                ))}
            </div>
        </div>
    );
};

const Paperbox = ({
    paper,
    browserBodyLoading = false,
    searchTerm,
    isPro,
    activeTool = null,
    persistHighlights = null,
    onAnalyzeFigure,
    onHighlight,
    onMarksChange,
    onSummarize,
    onShowHighlights,
    focusExcerpt = null,
    locateMethod = false,
    focusCitation = null,
    focusRequestId = 0,
}: PaperBoxProps) => {
    const [inkMarks, setInkMarks] = useState<InkMark[]>([]);
    const [focusMark, setFocusMark] = useState<InkMark | null>(null);
    const [openMarkId, setOpenMarkId] = useState<string | null>(null);
    const [copiedMarkId, setCopiedMarkId] = useState<string | null>(null);
    const deletedMarkIds = useRef(new Set<string>());
    const paperRef = useRef<HTMLDivElement>(null);
    const fingerDown = useRef(false);
    const touchEndedAt = useRef<number | null>(null);
    const settleTimer = useRef<number | null>(null);
    const commitHighlightRef = useRef<() => void>(() => {});
    const scheduleTouchCommitRef = useRef<() => void>(() => {});
    // Phones: a long-press selects one word, so saving on finger-up saved a
    // single word. Instead, let the reader adjust the selection handles and
    // tap an explicit "Highlight selection" button.
    const [touchSelection, setTouchSelection] = useState(false);
    const [coarsePointer, setCoarsePointer] = useState(false);
    const paperId = paper?.paperId;
    const persistDatabase = persistHighlights?.database || "";
    const persistPaperId = persistHighlights?.paperId || "";
    const persistIdName = persistHighlights?.idName || "";

    useEffect(() => {
        deletedMarkIds.current.clear();
        setInkMarks([]);
        setFocusMark(null);
        setOpenMarkId(null);
        setAgentTextHighlight(null);
    }, [paperId]);

    useEffect(() => {
        setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
    }, []);

    // Remeasuring changes only rects, so report on id/color changes alone.
    const reportedMarksKey = useRef<string | null>(null);
    useEffect(() => {
        const key = inkMarks.map((mark) => `${mark.id}:${mark.color}`).join("|");
        if (key === reportedMarksKey.current) return;
        reportedMarksKey.current = key;
        onMarksChange?.(
            inkMarks.map(({ id, excerpt, citation, color }) => ({
                id,
                excerpt,
                citation,
                color,
            })),
        );
    }, [inkMarks, onMarksChange]);

    const syncTouchSelection = () => {
        const selection = window.getSelection();
        const root = paperRef.current;
        setTouchSelection(
            Boolean(
                root &&
                    selection &&
                    selection.rangeCount > 0 &&
                    !selection.isCollapsed &&
                    root.contains(selection.getRangeAt(0).commonAncestorContainer) &&
                    selection.toString().trim(),
            ),
        );
    };

    scheduleTouchCommitRef.current = syncTouchSelection;

    useEffect(() => {
        if (activeTool !== "highlight") {
            if (settleTimer.current != null) {
                window.clearTimeout(settleTimer.current);
                settleTimer.current = null;
            }
            setTouchSelection(false);
            return;
        }
        const onSelectionChange = () => {
            // Handle drags fire no touchend on the paper; track the selection
            // itself so the button follows whatever is selected.
            if (touchEndedAt.current == null && !fingerDown.current) return;
            scheduleTouchCommitRef.current();
        };
        document.addEventListener("selectionchange", onSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange);
            if (settleTimer.current != null) {
                window.clearTimeout(settleTimer.current);
                settleTimer.current = null;
            }
        };
    }, [activeTool]);

    useEffect(() => {
        return () => {
            setAgentTextHighlight(null);
        };
    }, []);

    // Phones: keep the highlight in view above its action sheet.
    const sheetMarkId =
        coarsePointer && inkMarks.some((mark) => mark.id === openMarkId)
            ? openMarkId
            : null;
    useEffect(() => {
        if (!sheetMarkId) return;
        const frame = window.requestAnimationFrame(() => {
            const lines = paperRef.current?.querySelectorAll<HTMLElement>(
                `[data-ink-stroke="${CSS.escape(sheetMarkId)}"] > span`,
            );
            const sheet = document.querySelector<HTMLElement>(
                `[${HIGHLIGHT_SHEET_ATTR}]`,
            );
            if (lines && sheet) keepAboveSheet([...lines], sheet.offsetHeight);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [sheetMarkId]);

    useEffect(() => {
        if (!paper || !paperRef.current) return;
        if (!focusExcerpt && !locateMethod && !focusCitation) {
            setAgentTextHighlight(null);
            setFocusMark(null);
            return;
        }

        const quote = (
            focusExcerpt ||
            focusCitation?.lines.join(" ") ||
            ""
        )
            .replace(/\s+/g, " ")
            .trim();
        const citation = quote
            ? locateQuoteInPaper(
                  paper,
                  quote,
                  focusCitation?.sectionTitle || "Paper",
              )
            : focusCitation || locateMethodInPaper(paper, focusExcerpt);
        const excerpt = (
            citation.lines.join(" ") ||
            quote ||
            ""
        )
            .replace(/\s+/g, " ")
            .trim();

        const paint = (scrollToMatch: boolean) => {
            const root = paperRef.current;
            if (!root) return false;
            // Search the cited section first so a phrase repeated elsewhere
            // (often the abstract) does not steal the highlight.
            const citedSection = root.querySelector<HTMLElement>(
                `[data-section-title="${CSS.escape(citation.sectionTitle)}"]`,
            );
            const range = excerpt
                ? (citedSection && findExcerptRange(citedSection, excerpt)) ||
                  findExcerptRange(root, excerpt)
                : null;
            if (range) {
                const paintedOnText = setAgentTextHighlight(range);
                const rects = paintedOnText
                    ? []
                    : selectionRectsRelativeTo(range, root);
                setFocusMark({
                    id: `agent-focus-${focusRequestId}`,
                    excerpt,
                    rects,
                    citation,
                    color: DEFAULT_HIGHLIGHT_COLOR,
                });
                if (scrollToMatch) scrollRangeIntoView(range);
                return true;
            }

            if (!scrollToMatch) return true;
            setAgentTextHighlight(null);
            setFocusMark({
                id: `agent-focus-${focusRequestId}`,
                excerpt,
                rects: [],
                citation,
                color: DEFAULT_HIGHLIGHT_COLOR,
            });
            const section = root.querySelector(
                `[data-section-title="${CSS.escape(citation.sectionTitle)}"]`,
            );
            if (scrollToMatch) {
                section?.scrollIntoView({ block: "start", behavior: "smooth" });
            }
            return Boolean(section);
        };

        let retry = 0;
        let afterScroll = 0;
        const frame = window.requestAnimationFrame(() => {
            if (!paint(true)) {
                retry = window.setTimeout(() => paint(true), 120);
                return;
            }
            afterScroll = window.setTimeout(() => paint(false), 360);
        });
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(retry);
            window.clearTimeout(afterScroll);
        };
    }, [
        paper,
        paperId,
        focusExcerpt,
        locateMethod,
        focusCitation,
        focusRequestId,
    ]);

    useEffect(() => {
        if (!paperId || !persistDatabase || !persistPaperId || !persistIdName) {
            return;
        }
        const lookup = {
            database: persistDatabase,
            paperId: persistPaperId,
            idName: persistIdName,
        };
        let cancelled = false;
        void (async () => {
            const saved = await fetchPaperHighlights(lookup);
            if (cancelled) return;
            const root = paperRef.current;
            const savedMarks: InkMark[] = saved.map((record) => ({
                id: record.id,
                serverId: record.id,
                excerpt: record.excerpt,
                citation: record.citation,
                color: parseHighlightColor(record.color),
                rects: root ? measureExcerptRects(root, record.excerpt) : [],
            }));
            setInkMarks((current) => {
                const local = current.filter((mark) => !mark.serverId);
                return [...savedMarks, ...local];
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [paperId, persistDatabase, persistPaperId, persistIdName]);

    useEffect(() => {
        const root = paperRef.current;
        if (!root) return;
        const remeasure = () => {
            setInkMarks((current) => {
                if (current.length === 0) return current;
                let changed = false;
                const next = current.map((mark) => {
                    const rects = measureExcerptRects(root, mark.excerpt);
                    if (rects.length === 0 || rectsMatch(mark.rects, rects)) {
                        return mark;
                    }
                    changed = true;
                    return { ...mark, rects };
                });
                return changed ? next : current;
            });
        };
        const frame = window.requestAnimationFrame(remeasure);
        const observer = new ResizeObserver(remeasure);
        observer.observe(root);
        // The pane keeps its size when content above a highlight grows (the
        // Highlight hint, a figure loading), so watch the content too.
        for (const child of Array.from(root.children)) observer.observe(child);
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [paperId, inkMarks.length, activeTool]);

    if (!paper) {
        return null;
    }

    const handleHighlightPointerUp = () => {
        if (activeTool !== "highlight" || !paperRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return;
        }
        const range = selection.getRangeAt(0);
        if (!paperRef.current.contains(range.commonAncestorContainer)) return;
        const text = selectedTextFromRange(range);
        if (!text) return;
        const rects = selectionRectsRelativeTo(range, paperRef.current);
        if (rects.length === 0) return;
        const sectionNode =
            range.commonAncestorContainer instanceof Element
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentElement;
        const fallbackSection =
            sectionNode
                ?.closest("[data-section-title]")
                ?.getAttribute("data-section-title") || "Paper";
        selection.removeAllRanges();
        touchEndedAt.current = null;
        setTouchSelection(false);
        const id = crypto.randomUUID();
        const citation = locateExcerptInPaper(paper, text, fallbackSection);
        const mark: InkMark = {
            id,
            excerpt: text,
            rects,
            citation,
            color: DEFAULT_HIGHLIGHT_COLOR,
        };
        setInkMarks((current) => [...current, mark]);
        setOpenMarkId(id);
        if (persistHighlights) {
            void (async () => {
                const saved = await savePaperHighlight({
                    ...persistHighlights,
                    excerpt: text,
                    citation,
                    color: DEFAULT_HIGHLIGHT_COLOR,
                });
                if (!saved) return;
                if (deletedMarkIds.current.has(id)) {
                    await deletePaperHighlight(saved.id);
                    return;
                }
                setInkMarks((current) =>
                    current.map((item) =>
                        item.id === id
                            ? {
                                  ...item,
                                  serverId: saved.id,
                                  color: parseHighlightColor(saved.color),
                              }
                            : item,
                    ),
                );
            })();
        }
    };
    commitHighlightRef.current = handleHighlightPointerUp;

    const copyMarkWithCitation = (mark: InkMark) => {
        if (!paper) return;
        const excerpt = mark.excerpt || mark.citation.lines.join(" ").trim();
        const text = formatQuoteWithCitation({
            excerpt,
            sectionTitle: mark.citation.sectionTitle,
            attribution: paper.access.attribution,
            licenseName: paper.access.licenseName,
        });
        void navigator.clipboard
            ?.writeText(text)
            .then(() => {
                setCopiedMarkId(mark.id);
                window.setTimeout(
                    () => setCopiedMarkId((current) => (current === mark.id ? null : current)),
                    1600,
                );
            })
            .catch(() => undefined);
    };

    const sendMarkToChat = (mark: InkMark) => {
        const excerpt = mark.excerpt || mark.citation.lines.join(" ").trim();
        void navigator.clipboard?.writeText(excerpt).catch(() => undefined);
        onHighlight?.(mark.citation);
    };

    const setMarkColor = (mark: InkMark, color: HighlightColor) => {
        const nextColor = parseHighlightColor(color);
        if (mark.color === nextColor) return;
        setInkMarks((current) =>
            current.map((item) =>
                item.id === mark.id ? { ...item, color: nextColor } : item,
            ),
        );
        setOpenMarkId(mark.id);
        if (mark.serverId) {
            void updatePaperHighlightColor({
                highlightId: mark.serverId,
                color: nextColor,
            }).catch(() => undefined);
        }
    };

    const removeMark = (mark: InkMark) => {
        deletedMarkIds.current.add(mark.id);
        setInkMarks((current) =>
            current.filter((item) => item.id !== mark.id),
        );
        setOpenMarkId((current) => (current === mark.id ? null : current));
        if (mark.serverId) {
            void deletePaperHighlight(mark.serverId).catch(() => undefined);
        }
    };

    const markActions = (mark: InkMark): HighlightActionHandlers => ({
        color: parseHighlightColor(mark.color),
        copied: copiedMarkId === mark.id,
        onColor: (color) => setMarkColor(mark, color),
        onCopy: () => copyMarkWithCitation(mark),
        onAddToChat: () => {
            sendMarkToChat(mark);
            setOpenMarkId(null);
        },
        onRemove: () => removeMark(mark),
    });
    const openMark = inkMarks.find((mark) => mark.id === openMarkId) || null;
    const sheetMark = coarsePointer ? openMark : null;

    const showsBody = Boolean(
        paper.access.canDisplayFullText || paper.bodyLoadedInBrowser,
    );
    const contentsTitles = showsBody
        ? paper.paper
              .map((section) => section.title?.trim() || "")
              .filter(Boolean)
        : [];
    const accessLabel =
        paper.source === "scholar"
            ? "Search snippet + AI"
            : paper.access.canDisplayFullText
              ? "Full text + AI"
              : paper.bodyLoadedInBrowser
                ? "Full text from PubMed Central · AI uses the abstract"
                : paper.abstract
                  ? "Abstract"
                  : "Metadata only";
    const articleType =
        ARTICLE_TYPE_LABELS[paper.status?.articleType?.trim().toLowerCase() || ""] || "";
    const figureCount = showsBody
        ? paper.paper.reduce(
              (count, section) =>
                  count +
                  (section.figures || []).filter(isShownFigure).length +
                  section.subSections.reduce(
                      (subCount, sub) =>
                          subCount + (sub.figures || []).filter(isShownFigure).length,
                      0,
                  ),
              0,
          )
        : 0;
    let sectionNumber = 0;
    const showFirstFigure = () => {
        paperRef.current
            ?.querySelector<HTMLElement>("[data-paper-body] figure")
            ?.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    const jumpToSection = (title: string) => {
        paperRef.current
            ?.querySelector<HTMLElement>(
                `[data-section-title="${CSS.escape(title)}"]`,
            )
            ?.scrollIntoView({ block: "start", behavior: "smooth" });
    };

    return (
        <div className={styles.paperFrame}>
            <div
                className={clsx(styles.paperbox, {
                    [styles.highlighting]: activeTool === "highlight",
                })}
                ref={paperRef}
                onClick={(event) => {
                    const root = paperRef.current;
                    const selection = window.getSelection();
                    if (
                        !root ||
                        (selection && !selection.isCollapsed) ||
                        (event.target as HTMLElement).closest("[data-ink-mark]")
                    ) {
                        return;
                    }
                    const box = root.getBoundingClientRect();
                    const x = event.clientX - box.left + root.scrollLeft;
                    const y = event.clientY - box.top + root.scrollTop;
                    const hit = inkMarks.find((mark) =>
                        mark.rects.some(
                            (rect) =>
                                x >= rect.left &&
                                x <= rect.left + rect.width &&
                                y >= rect.top &&
                                y <= rect.top + rect.height,
                        ),
                    );
                    if (hit) setOpenMarkId(hit.id);
                }}
                onPointerDown={(event) => {
                    if (event.pointerType === "touch") {
                        fingerDown.current = true;
                        if (settleTimer.current != null) {
                            window.clearTimeout(settleTimer.current);
                            settleTimer.current = null;
                        }
                        return;
                    }
                    if (
                        !isSyntheticMouseAfterTouch(
                            touchEndedAt.current,
                            Date.now(),
                        )
                    ) {
                        touchEndedAt.current = null;
                    }
                    if (
                        !(event.target as HTMLElement).closest("[data-ink-mark]")
                    ) {
                        setOpenMarkId(null);
                    }
                }}
                onPointerUp={(event) => {
                    if (event.pointerType === "touch") {
                        fingerDown.current = false;
                        touchEndedAt.current = Date.now();
                        scheduleTouchCommitRef.current();
                        return;
                    }
                    if (
                        isSyntheticMouseAfterTouch(
                            touchEndedAt.current,
                            Date.now(),
                        )
                    ) {
                        return;
                    }
                    commitHighlightRef.current();
                }}
                onTouchStart={() => {
                    fingerDown.current = true;
                    if (settleTimer.current != null) {
                        window.clearTimeout(settleTimer.current);
                        settleTimer.current = null;
                    }
                }}
                onTouchEnd={() => {
                    fingerDown.current = false;
                    touchEndedAt.current = Date.now();
                    scheduleTouchCommitRef.current();
                }}
            >
                {/* Highlight strokes sit behind the paper text, so the words
                    read on top of the ink. Handles and the bar stay above. */}
                {inkMarks.length > 0 && (
                    <div className={styles.inkUnderlay} aria-hidden="true">
                        {inkMarks.map((mark) => (
                            <div
                                key={mark.id}
                                data-ink-stroke={mark.id}
                                className={clsx(
                                    styles.inkMark,
                                    INK_COLOR_CLASS[parseHighlightColor(mark.color)],
                                    {
                                        [styles.inkMarkOpen]:
                                            openMarkId === mark.id,
                                    },
                                )}
                            >
                                {mark.rects.map((rect, index) => (
                                    <span
                                        key={`${mark.id}-${index}`}
                                        className={styles.ink}
                                        style={{
                                            left: rect.left,
                                            top: rect.top,
                                            width: rect.width,
                                            height: rect.height,
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
                {(inkMarks.length > 0 ||
                    (focusMark && focusMark.rects.length > 0)) && (
                    <div className={styles.inkLayer} data-ink-layer="">
                        {focusMark
                            ? focusMark.rects.map((rect, index) => (
                                  <span
                                      key={`focus-${index}`}
                                      data-agent-focus={
                                          index === 0 ? "" : undefined
                                      }
                                      className={clsx(
                                          styles.ink,
                                          styles.inkAgent,
                                      )}
                                      style={{
                                          left: rect.left,
                                          top: rect.top,
                                          width: rect.width,
                                          height: rect.height,
                                      }}
                                      title={citationLabel(focusMark.citation)}
                                  />
                              ))
                            : null}
                        {inkMarks.map((mark) => {
                            const first = mark.rects[0];
                            const end = mark.rects[mark.rects.length - 1];
                            const color = parseHighlightColor(mark.color);
                            return (
                                <div
                                    key={mark.id}
                                    data-ink-mark={mark.id}
                                    data-ink-color={color}
                                    className={clsx(
                                        styles.inkMark,
                                        INK_COLOR_CLASS[color],
                                        {
                                            [styles.inkMarkOpen]:
                                                openMarkId === mark.id,
                                        },
                                    )}
                                >
                                    {end && (
                                        <div
                                            data-ink-end=""
                                            className={styles.inkEnd}
                                            style={{
                                                left: end.left + end.width,
                                                top: end.top + end.height / 2,
                                            }}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                            }}
                                            onMouseUp={(event) =>
                                                event.stopPropagation()
                                            }
                                            onTouchEnd={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            <button
                                                type="button"
                                                className={styles.inkHandle}
                                                aria-label={`Highlight actions, ${HIGHLIGHT_COLOR_LABELS[color]}`}
                                                aria-expanded={
                                                    openMarkId === mark.id
                                                }
                                                onClick={() =>
                                                    setOpenMarkId((current) =>
                                                        current === mark.id
                                                            ? null
                                                            : mark.id,
                                                    )
                                                }
                                            />
                                        </div>
                                    )}
                                    {openMarkId === mark.id &&
                                        !coarsePointer &&
                                        first &&
                                        end && (
                                            <HighlightActionBar
                                                anchor={{
                                                    left: first.left,
                                                    top: first.top,
                                                    bottom: end.top + end.height,
                                                }}
                                                {...markActions(mark)}
                                            />
                                        )}
                                </div>
                            );
                        })}
                    </div>
                )}
            <div className={styles.readerLayout}>
            {showsBody && (
                <PaperContents
                    sections={contentsTitles}
                    paneRef={paperRef}
                    figureCount={figureCount}
                    highlightCount={inkMarks.length}
                    onShowFigures={showFirstFigure}
                    onShowHighlights={onShowHighlights}
                />
            )}
            <div className={styles.article}>
            <div className={styles.metaRow}>
                {articleType && (
                    <span className={clsx(styles.metaTag, styles.metaTagType)}>
                        {articleType}
                    </span>
                )}
                <span className={styles.metaTag}>{paper.primarySource}</span>
                <span
                    className={clsx(
                        styles.metaTag,
                        paper.access.canDisplayFullText && styles.metaTagGood,
                    )}
                >
                    {paper.access.licenseName &&
                        (paper.access.licenseUrl ? (
                            <a
                                href={paper.access.licenseUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {paper.access.licenseName}
                            </a>
                        ) : (
                            paper.access.licenseName
                        ))}
                    {paper.access.licenseName && " · "}
                    {accessLabel}
                </span>
                {paper.access.attribution.publicationDate && (
                    <span className={styles.metaTag}>
                        {formatPaperDate(paper.access.attribution.publicationDate)}
                    </span>
                )}
                <a
                    className={styles.metaLink}
                    href={paper.access.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    Open original <span aria-hidden="true">↗</span>
                </a>
            </div>
            <h1 className={clsx(styles.title, styles.text)}>
                <HighlightSearchTitle
                    title={paper.title}
                    searchValue={searchTerm || ""}
                    highlightClass={getTitleHighlightClass(paper.source)}
                />
            </h1>
            <PaperAuthors key={paper.paperId} authors={paper.authors} />
            {activeTool === "highlight" && !coarsePointer && (
                <HighlightHint
                    count={inkMarks.length}
                    saved={Boolean(persistHighlights)}
                />
            )}
            {paper.citationCount ? (
                <PaperImpactBadge
                    citationCount={paper.citationCount}
                    citationSource={paper.citationSource}
                    doi={paper.access?.attribution?.doi}
                    sourcePaper={{
                        title: paper.title,
                        doi: paper.access?.attribution?.doi,
                        authors: paper.authors,
                        year: paper.publicationDate,
                    }}
                    className={styles.impactBadge}
                />
            ) : null}
            {showsBody && (
                <PaperSignificance
                    paper={paper}
                    onJump={jumpToSection}
                    onSummarize={onSummarize}
                />
            )}
            <p className={styles.metaFine}>
                {paper.idName.toUpperCase()} {paper.paperId}
                {paper.access.normalizedLicense === "CC-BY" &&
                    " · Article text has been parsed and reformatted for this interface. AI answers summarize selected excerpts."}
            </p>
            {paper.status?.isRetracted && (
                <p className={styles.statusWarning}>
                    Retraction warning: the source marks this article as
                    retracted. Verify its status at the canonical source.
                </p>
            )}
            {paper.bodyLoadedInBrowser ? (
                <p className={styles.contentNotice}>
                    This paper&apos;s license doesn&apos;t allow reuse, so
                    your browser loads it directly from PubMed Central.
                    Expansive Mind doesn&apos;t store it, and the assistant
                    answers from the abstract only.
                </p>
            ) : browserBodyLoading ? (
                <p className={styles.contentNotice} role="status">
                    Loading the full text from PubMed Central…
                </p>
            ) : (
                paper.contentNotice && (
                    <p className={styles.contentNotice}>
                        {paper.contentNotice}
                    </p>
                )
            )}
            {!paper.access.canDisplayFullText &&
                !paper.bodyLoadedInBrowser &&
                paper.abstract && (
                    <div className={styles.paper}>
                        <div className={styles.section}>
                            <h4>Abstract</h4>
                            <p>{paper.abstract}</p>
                        </div>
                    </div>
                )}
            {(paper.access.canDisplayFullText || paper.bodyLoadedInBrowser) && (
                <div className={styles.paper} data-paper-body="">
                    {paper.paper.map((section, index) => (
                        <Section
                            section={section}
                            key={`${section.title || "section"}-${index}`}
                            number={
                                section.title?.trim()
                                    ? (sectionNumber += 1)
                                    : undefined
                            }
                            isPro={isPro}
                            onAnalyzeFigure={onAnalyzeFigure}
                        />
                    ))}
                </div>
            )}
            </div>
            </div>
            </div>
            {/* On the page root, so it covers the site's bottom navigation. */}
            {sheetMark &&
                createPortal(
                    <HighlightActionSheet
                        {...markActions(sheetMark)}
                        sectionTitle={sheetMark.citation.sectionTitle}
                        saved={Boolean(persistHighlights)}
                        highlightCount={inkMarks.length}
                        onShowHighlights={
                            onShowHighlights
                                ? () => {
                                      setOpenMarkId(null);
                                      onShowHighlights();
                                  }
                                : undefined
                        }
                        onClose={() => setOpenMarkId(null)}
                    />,
                    document.body,
                )}
            {activeTool === "highlight" && coarsePointer && !sheetMark && (
                <div className={styles.touchHighlightBar} role="status">
                    <p className={styles.touchHighlightHint}>
                        {touchSelection
                            ? "Drag the handles to fit the passage, then tap Highlight selection."
                            : "Press and hold a passage to select it, then tap Highlight selection."}
                    </p>
                    <button
                        type="button"
                        className={styles.touchHighlightButton}
                        disabled={!touchSelection}
                        // Act on pointerdown and keep focus off the button,
                        // or iOS clears the selection before the tap lands.
                        onPointerDown={(event) => {
                            event.preventDefault();
                            commitHighlightRef.current();
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M4 20h6M14.5 5.5l4 4L9 19H5v-4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                        </svg>
                        Highlight selection
                    </button>
                </div>
            )}
        </div>
    );
};

export default Paperbox;
