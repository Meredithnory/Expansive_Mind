"use client";

import React, { useEffect, useRef, useState } from "react";
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
import type { PaperCitation } from "../../lib/paper-citation";
import {
    citationLabel,
    locateExcerptInPaper,
    locateMethodInPaper,
} from "../../lib/paper-citation";
import {
    findExcerptRange,
    selectedTextFromRange,
    selectionRectsRelativeTo,
    type PaperTool,
} from "../../lib/region-capture";
import {
    deletePaperHighlight,
    fetchPaperHighlights,
    savePaperHighlight,
} from "../../lib/paper-highlights";

const AGENT_HIGHLIGHT = "agent-focus";
const AGENT_HIGHLIGHT_STYLE_ID = "agent-focus-highlight-style";

const ensureAgentHighlightStyle = () => {
    if (typeof document === "undefined") return;
    if (document.getElementById(AGENT_HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = AGENT_HIGHLIGHT_STYLE_ID;
    style.textContent =
        "::highlight(agent-focus){color:inherit;background-color:rgba(255,195,122,.48)}";
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
        return (
            <figure className={styles.graphicSection} key={figure.id}>
                {title && (
                    <figcaption className={styles.graphicTitle}>
                        {title}
                    </figcaption>
                )}
                {figure.imageUrl && figure.canAnalyzeSourceImage && (
                    <div className={styles.figureImage}>
                        <Image
                            src={figure.imageUrl}
                            alt={title || "Research paper figure"}
                            fill
                            unoptimized
                            style={{ objectFit: "contain" }}
                            sizes="(max-width: 768px) 100vw, 800px"
                        />
                    </div>
                )}
                {figure.caption && <p>{figure.caption}</p>}
                {figure.canAnalyzeSourceImage && (
                    <div className={styles.figureActions}>
                        <button
                            type="button"
                            disabled={!isPro}
                            onClick={() => onAnalyzeFigure(figure)}
                            aria-label={`Explain ${figure.label}`}
                        >
                            {isPro
                                ? "Explain this figure"
                                : "Pro: Explain this figure"}
                        </button>
                    </div>
                )}
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
    isPro,
    onAnalyzeFigure,
}: {
    section: SectionInterface;
    isPro: boolean;
    onAnalyzeFigure: (figure: PaperFigure) => void;
}) => {
    return (
        <div className={styles.section} data-section-title={section.title || "Paper"}>
            {section.title && <h4>{section.title}</h4>}
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
    searchTerm,
    isPro,
    activeTool = null,
    persistHighlights = null,
    onAnalyzeFigure,
    onHighlight,
    focusExcerpt = null,
    locateMethod = false,
    focusCitation = null,
    focusRequestId = 0,
}: PaperBoxProps) => {
    const [inkMarks, setInkMarks] = useState<InkMark[]>([]);
    const [focusMark, setFocusMark] = useState<InkMark | null>(null);
    const [openMarkId, setOpenMarkId] = useState<string | null>(null);
    const deletedMarkIds = useRef(new Set<string>());
    const paperRef = useRef<HTMLDivElement>(null);
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
        return () => {
            setAgentTextHighlight(null);
        };
    }, []);

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
            ? locateExcerptInPaper(
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
            const range = excerpt ? findExcerptRange(root, excerpt) : null;
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
                });
                if (scrollToMatch) {
                    const node = range.startContainer;
                    const target =
                        node instanceof Element ? node : node.parentElement;
                    target?.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                    });
                }
                return true;
            }

            if (!scrollToMatch) return true;
            setAgentTextHighlight(null);
            setFocusMark({
                id: `agent-focus-${focusRequestId}`,
                excerpt,
                rects: [],
                citation,
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
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [paperId, inkMarks.length]);

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
        const id = crypto.randomUUID();
        const citation = locateExcerptInPaper(paper, text, fallbackSection);
        const mark: InkMark = { id, excerpt: text, rects, citation };
        setInkMarks((current) => [...current, mark]);
        setOpenMarkId(id);
        if (persistHighlights) {
            void (async () => {
                const saved = await savePaperHighlight({
                    ...persistHighlights,
                    excerpt: text,
                    citation,
                });
                if (!saved) return;
                if (deletedMarkIds.current.has(id)) {
                    await deletePaperHighlight(saved.id);
                    return;
                }
                setInkMarks((current) =>
                    current.map((item) =>
                        item.id === id
                            ? { ...item, serverId: saved.id }
                            : item,
                    ),
                );
            })();
        }
    };

    const sendMarkToChat = (mark: InkMark) => {
        const excerpt = mark.excerpt || mark.citation.lines.join(" ").trim();
        void navigator.clipboard?.writeText(excerpt).catch(() => undefined);
        onHighlight?.(mark.citation);
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

    return (
        <div className={styles.paperFrame}>
            <div
                className={clsx(styles.paperbox, {
                    [styles.highlighting]: activeTool === "highlight",
                })}
                ref={paperRef}
                onMouseDown={(event) => {
                    if (
                        !(event.target as HTMLElement).closest("[data-ink-mark]")
                    ) {
                        setOpenMarkId(null);
                    }
                }}
                onMouseUp={handleHighlightPointerUp}
                onTouchEnd={handleHighlightPointerUp}
            >
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
                            const end = mark.rects[mark.rects.length - 1];
                            return (
                                <div
                                    key={mark.id}
                                    data-ink-mark=""
                                    className={clsx(styles.inkMark, {
                                        [styles.inkMarkOpen]:
                                            openMarkId === mark.id,
                                    })}
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
                                            <span
                                                className={styles.inkHandle}
                                                aria-hidden="true"
                                            />
                                            <div className={styles.inkActions}>
                                                <button
                                                    type="button"
                                                    className={styles.inkSend}
                                                    onClick={() =>
                                                        sendMarkToChat(mark)
                                                    }
                                                    aria-label="Add highlight to chat"
                                                    title="Add to chat"
                                                >
                                                    ¶
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.inkDismiss}
                                                    onClick={() =>
                                                        removeMark(mark)
                                                    }
                                                    aria-label="Remove highlight"
                                                    title="Remove highlight"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            <h1 className={clsx(styles.title, styles.text)}>
                <HighlightSearchTitle
                    title={paper.title}
                    searchValue={searchTerm || ""}
                    highlightClass={getTitleHighlightClass(paper.source)}
                />
            </h1>
            <div className={styles.authors}>{paper.authors.join(", ")}</div>
            <div className={styles.pmcid}>
                Source: {paper.primarySource} | ID ({paper.idName}):{" "}
                {paper.paperId}
            </div>
            <div className={styles.attribution}>
                <div>
                    Access:{" "}
                    <strong>
                        {paper.source === "scholar"
                            ? "Search snippet + AI"
                            : paper.access.canDisplayFullText
                            ? "Full text + AI"
                            : "Metadata only"}
                    </strong>
                </div>
                {paper.access.licenseName && (
                    <div>
                        License:{" "}
                        {paper.access.licenseUrl ? (
                            <a
                                href={paper.access.licenseUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {paper.access.licenseName}
                            </a>
                        ) : (
                            paper.access.licenseName
                        )}
                    </div>
                )}
                {paper.access.attribution.publicationDate && (
                    <div>
                        Published:{" "}
                        {paper.access.attribution.publicationDate}
                    </div>
                )}
                <a
                    href={paper.access.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    Open the canonical source
                </a>
                {paper.access.normalizedLicense === "CC-BY" && (
                    <div>
                        Article text has been parsed and reformatted for this
                        interface. AI answers summarize selected excerpts.
                    </div>
                )}
            </div>
            {paper.status?.isRetracted && (
                <p className={styles.statusWarning}>
                    Retraction warning: the source marks this article as
                    retracted. Verify its status at the canonical source.
                </p>
            )}
            {paper.contentNotice && (
                <p className={styles.contentNotice}>{paper.contentNotice}</p>
            )}
            {paper.access.canDisplayFullText && (
                <div className={styles.paper} data-paper-body="">
                    {paper.paper.map((section, index) => (
                        <Section
                            section={section}
                            key={`${section.title || "section"}-${index}`}
                            isPro={isPro}
                            onAnalyzeFigure={onAnalyzeFigure}
                        />
                    ))}
                </div>
            )}
            </div>
        </div>
    );
};

export default Paperbox;
