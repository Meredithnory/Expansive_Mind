"use client";

import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type CSSProperties,
    type FocusEvent,
    type KeyboardEvent,
    type MouseEvent,
    type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
    citationCountSourceLine,
    citationCredibilityNote,
    citationPopularity,
    citationRankReason,
    citationRankingGuide,
    formatCitationCount,
    parseCitationCount,
    type CitationSource,
} from "../lib/paper-impact";
import {
    CITING_WORKS_PAGE_SIZE,
    buildCitingPaperHref,
    citingWorksCacheKey,
    citingWorksTruncatedNote,
    formatCitingAuthors,
    mergeCitingWorks,
    type CiteSourcePaper,
    type CitingWork,
    type CitingWorksResult,
} from "../lib/citing-works";
import { storeCiteFocusSource } from "../lib/cite-source-focus";
import styles from "./styles/paper-impact.module.scss";

type PaperImpactBadgeProps = {
    citationCount?: number | null;
    citationSource?: CitationSource;
    doi?: string | null;
    scholarCitesId?: string | null;
    sourcePaper?: CiteSourcePaper | null;
    className?: string;
};

type MenuPlacement = {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placeBelow: boolean;
};

const MENU_MAX_HEIGHT = 380;
const MENU_MAX_WIDTH = 380;
const VIEWPORT_PAD = 16;
const SCROLL_LOAD_THRESHOLD_PX = 72;

const clientCache = new Map<string, CitingWorksResult>();

function pageCacheKey(
    identityKey: string,
    offset: number,
    limit: number,
): string {
    return `${identityKey}:v4:offset:${offset}:limit:${limit}`;
}

function useTapToggleMode() {
    const [tapMode, setTapMode] = useState(false);

    useEffect(() => {
        const hoverQuery = window.matchMedia(
            "(hover: hover) and (pointer: fine)",
        );
        const widthQuery = window.matchMedia("(max-width: 390px)");
        const sync = () => {
            setTapMode(!hoverQuery.matches || widthQuery.matches);
        };
        sync();
        hoverQuery.addEventListener("change", sync);
        widthQuery.addEventListener("change", sync);
        return () => {
            hoverQuery.removeEventListener("change", sync);
            widthQuery.removeEventListener("change", sync);
        };
    }, []);

    return tapMode;
}

function computeMenuPlacement(trigger: DOMRect): MenuPlacement {
    const width = Math.min(
        MENU_MAX_WIDTH,
        Math.max(240, window.innerWidth - VIEWPORT_PAD * 2),
    );
    const left = Math.min(
        Math.max(trigger.left, VIEWPORT_PAD),
        Math.max(VIEWPORT_PAD, window.innerWidth - VIEWPORT_PAD - width),
    );

    const spaceBelow = window.innerHeight - trigger.bottom - VIEWPORT_PAD;
    const spaceAbove = trigger.top - VIEWPORT_PAD;
    const placeBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    const available = Math.max(160, placeBelow ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(MENU_MAX_HEIGHT, available);

    // Flush to the badge so hover can move between trigger and menu.
    let top = placeBelow ? trigger.bottom : trigger.top - maxHeight;
    const maxTop = window.innerHeight - VIEWPORT_PAD - Math.min(maxHeight, 120);
    top = Math.min(Math.max(top, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, maxTop));

    return { top, left, width, maxHeight, placeBelow };
}

async function fetchCitingWorksPage(input: {
    doi?: string | null;
    scholarCitesId?: string | null;
    offset: number;
    limit?: number;
}): Promise<CitingWorksResult> {
    const key = citingWorksCacheKey(input);
    const limit = input.limit ?? CITING_WORKS_PAGE_SIZE;
    if (!key) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: null,
            unavailableReason:
                "Citing papers are not available. This result has a citation count but no Scholar cites id or DOI to fetch the list.",
        };
    }
    const cached = clientCache.get(pageCacheKey(key, input.offset, limit));
    if (cached) return cached;

    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(input.offset),
    });
    if (input.scholarCitesId) params.set("citesId", input.scholarCitesId);
    if (input.doi) params.set("doi", input.doi);

    const response = await fetch(`/api/citations?${params.toString()}`);
    if (!response.ok) {
        return {
            works: [],
            total: 0,
            hasMore: false,
            source: input.scholarCitesId
                ? "scholar"
                : input.doi
                  ? "crossref"
                  : null,
            unavailableReason: "Citing papers could not be loaded right now.",
        };
    }
    const data = (await response.json()) as CitingWorksResult;
    clientCache.set(pageCacheKey(key, input.offset, limit), data);
    return data;
}

export default function PaperImpactBadge({
    citationCount,
    citationSource,
    doi,
    scholarCitesId,
    sourcePaper = null,
    className,
}: PaperImpactBadgeProps) {
    const router = useRouter();
    const count = parseCitationCount(citationCount);
    const menuId = useId();
    const wrapRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const tapMode = useTapToggleMode();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [result, setResult] = useState<CitingWorksResult | null>(null);
    const [placement, setPlacement] = useState<MenuPlacement | null>(null);
    const [portalReady, setPortalReady] = useState(false);
    const closeTimer = useRef<number | null>(null);
    const openRef = useRef(false);
    const loadingRef = useRef(false);
    const loadingMoreRef = useRef(false);
    const resultRef = useRef<CitingWorksResult | null>(null);

    const popularity = count == null ? null : citationPopularity(count);
    const canOpen = count != null && count > 0;

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        resultRef.current = result;
    }, [result]);

    const clearCloseTimer = () => {
        if (closeTimer.current != null) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const scheduleClose = () => {
        clearCloseTimer();
        closeTimer.current = window.setTimeout(() => {
            openRef.current = false;
            setOpen(false);
            setPlacement(null);
        }, 180);
    };

    const isInsidePopover = (node: EventTarget | null) => {
        if (!(node instanceof Node)) return false;
        return Boolean(
            wrapRef.current?.contains(node) || menuRef.current?.contains(node),
        );
    };

    const updatePlacement = () => {
        const trigger = triggerRef.current;
        if (!trigger || !openRef.current) return;
        setPlacement(computeMenuPlacement(trigger.getBoundingClientRect()));
    };

    const loadFirstPage = async () => {
        if (resultRef.current || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const next = await fetchCitingWorksPage({
                doi,
                scholarCitesId,
                offset: 0,
            });
            setResult(next);
            resultRef.current = next;
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    };

    const loadNextPage = useCallback(async () => {
        const current = resultRef.current;
        if (!current?.hasMore || loadingMoreRef.current) return;
        const offset =
            current.nextOffset ?? current.works.length;
        if (offset <= 0) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const page = await fetchCitingWorksPage({
                doi,
                scholarCitesId,
                offset,
            });
            const mergedWorks = mergeCitingWorks(current.works, page.works);
            const total = Math.max(current.total, page.total, mergedWorks.length);
            const reachedTotal = total > 0 && mergedWorks.length >= total;
            // Stop if the page added nothing new (exhausted / all duplicates).
            const appended = mergedWorks.length > current.works.length;
            const hasMore =
                appended && page.hasMore && !reachedTotal;
            const nextOffset = hasMore
                ? (page.nextOffset ?? mergedWorks.length)
                : undefined;
            const truncatedNote =
                page.truncatedNote ||
                citingWorksTruncatedNote(mergedWorks.length, total, hasMore);
            const next: CitingWorksResult = {
                works: mergedWorks,
                total,
                hasMore,
                ...(nextOffset != null ? { nextOffset } : {}),
                source: page.source || current.source,
                ...(truncatedNote ? { truncatedNote } : {}),
                ...(page.unavailableReason && mergedWorks.length === 0
                    ? { unavailableReason: page.unavailableReason }
                    : {}),
            };
            setResult(next);
            resultRef.current = next;
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [doi, scholarCitesId]);

    const onMenuScroll = (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remaining <= SCROLL_LOAD_THRESHOLD_PX) {
            void loadNextPage();
        }
    };

    const openMenu = () => {
        if (!canOpen) return;
        clearCloseTimer();
        const trigger = triggerRef.current;
        const nextPlacement = trigger
            ? computeMenuPlacement(trigger.getBoundingClientRect())
            : {
                  top: VIEWPORT_PAD,
                  left: VIEWPORT_PAD,
                  width: Math.min(MENU_MAX_WIDTH, 320),
                  maxHeight: MENU_MAX_HEIGHT,
                  placeBelow: true,
              };
        openRef.current = true;
        setPlacement(nextPlacement);
        setOpen(true);
        void loadFirstPage();
    };

    const closeMenu = () => {
        clearCloseTimer();
        openRef.current = false;
        setOpen(false);
        setPlacement(null);
    };

    useEffect(() => {
        if (!open) return;
        updatePlacement();
        const onReposition = () => updatePlacement();
        window.addEventListener("resize", onReposition);
        window.addEventListener("scroll", onReposition, true);
        return () => {
            window.removeEventListener("resize", onReposition);
            window.removeEventListener("scroll", onReposition, true);
        };
    }, [open, result, loading, loadingMore]);

    // If the first page fits without scrolling, still fetch more until filled or exhausted.
    useEffect(() => {
        if (!open || !result?.hasMore || loadingMore) return;
        const body = bodyRef.current;
        if (!body) return;
        if (body.scrollHeight <= body.clientHeight + SCROLL_LOAD_THRESHOLD_PX) {
            void loadNextPage();
        }
    }, [open, result, loadingMore, loadNextPage]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                closeMenu();
            }
        };
        const onPointerDown = (event: PointerEvent) => {
            if (!isInsidePopover(event.target)) {
                closeMenu();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("pointerdown", onPointerDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    useEffect(() => () => clearCloseTimer(), []);

    if (count == null || !popularity) return null;

    const onTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!canOpen) return;
        if (tapMode) {
            if (open) closeMenu();
            else openMenu();
            return;
        }
        openMenu();
    };

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            if (open) closeMenu();
            else openMenu();
        } else if (event.key === "Escape" && open) {
            event.preventDefault();
            closeMenu();
        }
    };

    const onBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!isInsidePopover(event.relatedTarget)) {
            scheduleClose();
        }
    };

    // Prefer the count provider (Crossref / Scholar / Europe PMC) over the
    // citing-works list source so Emerging shows where the number came from
    // even before the menu fetch finishes.
    const countSourceLine = citationCountSourceLine(citationSource);

    const openCitingWork = (
        event: MouseEvent,
        work: CitingWork,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        const href = buildCitingPaperHref(work);
        if (!href) return;
        if (sourcePaper?.title) {
            storeCiteFocusSource({
                title: sourcePaper.title,
                doi: sourcePaper.doi,
                authors: sourcePaper.authors,
                year: sourcePaper.year,
            });
        }
        const separator = href.includes("?") ? "&" : "?";
        router.push(`${href}${separator}citeFocus=1`);
        closeMenu();
    };

    const menuStyle: CSSProperties | undefined = placement
        ? {
              top: placement.top,
              left: placement.left,
              width: placement.width,
              maxWidth: placement.width,
              maxHeight: placement.maxHeight,
          }
        : undefined;

    const menu =
        canOpen && open && placement && portalReady
            ? createPortal(
                  <div
                      id={menuId}
                      ref={menuRef}
                      className={clsx(
                          styles.menu,
                          placement.placeBelow
                              ? styles.menuBelow
                              : styles.menuAbove,
                      )}
                      role="region"
                      aria-label="Papers that cite this work"
                      style={menuStyle}
                      onMouseEnter={() => {
                          clearCloseTimer();
                      }}
                      onMouseLeave={() => {
                          if (!tapMode) scheduleClose();
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onWheel={(event) => event.stopPropagation()}
                  >
                      <div className={styles.menuHeader}>
                          <div className={styles.menuHeaderRow}>
                              <span className={styles.menuTitle}>Cited by</span>
                              <span className={styles.menuSource}>
                                  {countSourceLine}
                              </span>
                          </div>
                          <p className={styles.menuRank}>
                              {citationRankReason(count)}{" "}
                              {citationRankingGuide()}
                          </p>
                      </div>
                      <div
                          ref={bodyRef}
                          className={styles.menuBody}
                          tabIndex={0}
                          aria-label="Citing paper list"
                          onScroll={onMenuScroll}
                      >
                          {loading && !result ? (
                              <p className={styles.menuStatus}>
                                  Loading citing papers…
                              </p>
                          ) : result && result.works.length > 0 ? (
                              <>
                                  <ul className={styles.menuList}>
                                      {result.works.map((work, index) => {
                                          const meta = [
                                              formatCitingAuthors(work.authors),
                                              work.year != null
                                                  ? String(work.year)
                                                  : null,
                                          ]
                                              .filter(Boolean)
                                              .join(" · ");
                                          const content = (
                                              <>
                                                  <span
                                                      className={styles.workTitle}
                                                  >
                                                      {work.title}
                                                  </span>
                                                  {meta ? (
                                                      <span
                                                          className={
                                                              styles.workMeta
                                                          }
                                                      >
                                                          {meta}
                                                      </span>
                                                  ) : null}
                                              </>
                                          );
                                          return (
                                              <li
                                                  key={`${work.doi || work.clusterId || work.title}-${index}`}
                                                  className={styles.menuItem}
                                              >
                                                  {buildCitingPaperHref(
                                                      work,
                                                  ) ? (
                                                      <button
                                                          type="button"
                                                          className={
                                                              styles.workLink
                                                          }
                                                          aria-label={work.title}
                                                          onClick={(event) =>
                                                              openCitingWork(
                                                                  event,
                                                                  work,
                                                              )
                                                          }
                                                          onMouseDown={(
                                                              event,
                                                          ) =>
                                                              event.stopPropagation()
                                                          }
                                                      >
                                                          {content}
                                                      </button>
                                                  ) : work.url ? (
                                                      <a
                                                          className={
                                                              styles.workLink
                                                          }
                                                          href={work.url}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          onClick={(event) =>
                                                              event.stopPropagation()
                                                          }
                                                      >
                                                          {content}
                                                      </a>
                                                  ) : (
                                                      <div
                                                          className={
                                                              styles.workPlain
                                                          }
                                                      >
                                                          {content}
                                                      </div>
                                                  )}
                                              </li>
                                          );
                                      })}
                                  </ul>
                                  {loadingMore ? (
                                      <p
                                          className={styles.menuStatus}
                                          aria-live="polite"
                                      >
                                          Loading more…
                                      </p>
                                  ) : null}
                                  {!result.hasMore && result.truncatedNote ? (
                                      <p className={styles.menuMore}>
                                          {result.truncatedNote}
                                      </p>
                                  ) : null}
                              </>
                          ) : (
                              <p className={styles.menuStatus}>
                                  {result?.unavailableReason ||
                                      "Citing papers are not available for this result."}
                              </p>
                          )}
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div
            ref={wrapRef}
            className={clsx(styles.wrap, open && styles.wrapOpen, className)}
            onMouseEnter={() => {
                if (!tapMode) openMenu();
            }}
            onMouseLeave={(event) => {
                if (tapMode) return;
                // Portaled menu is outside the wrap; don't close when moving onto it.
                if (isInsidePopover(event.relatedTarget)) {
                    clearCloseTimer();
                    return;
                }
                scheduleClose();
            }}
            onFocusCapture={() => {
                if (!tapMode) openMenu();
            }}
            onBlurCapture={onBlur}
        >
            <button
                ref={triggerRef}
                type="button"
                className={clsx(styles.badge, styles[popularity.level], {
                    [styles.badgeOpen]: open,
                    [styles.badgeInteractive]: canOpen,
                })}
                title={`${formatCitationCount(count)} · ${popularity.label}. ${citationRankReason(count)} ${citationRankingGuide()} ${countSourceLine}. ${citationCredibilityNote(citationSource)}`}
                aria-label={`${formatCitationCount(count)}. ${popularity.label}. ${citationRankReason(count)} ${citationCredibilityNote(citationSource)}${canOpen ? " Show citing papers." : ""}`}
                aria-haspopup={canOpen ? "true" : undefined}
                aria-expanded={canOpen ? open : undefined}
                aria-controls={canOpen ? menuId : undefined}
                tabIndex={canOpen ? 0 : -1}
                onClick={onTriggerClick}
                onKeyDown={onTriggerKeyDown}
            >
                <span className={styles.count}>{formatCitationCount(count)}</span>
                <span className={styles.popularity}>{popularity.label}</span>
            </button>
            {menu}
        </div>
    );
}
