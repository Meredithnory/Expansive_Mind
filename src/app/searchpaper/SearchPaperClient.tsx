"use client";
import React, {
    useCallback,
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
    type ReactNode,
} from "react";
import SearchBar from "../components/SearchBar";
import { useRouter } from "next/navigation";
import styles from "./searchpaper.module.scss";
import resultStyles from "./search-results.module.scss";
import SearchResults, { type SearchResult } from "../components/SearchResults";
import { SearchLoadingOverlay } from "../components/Loading";
import { searchQueriesMatch } from "../lib/search-suggest";
import { useInlineSearchSuggestion } from "../lib/use-inline-search-suggestion";
import Image from "next/image";
import clsx from "clsx";
import { useSession } from "../lib/use-session";
import Link from "next/link";
import posthog from "posthog-js";
import { logActivity } from "../lib/activity";
import { showLimitReached } from "../lib/limit-reached";
import { PAYMENTS_VISIBLE, SCHOLAR_SOURCE_LABEL } from "../lib/payments";
import { NEED_MORE_HREF, NEED_MORE_LABEL } from "../lib/plan-messages";
import {
    DATE_FILTERS,
    dateFilterLabel,
    parseDateFilter,
    parseSourceFilter,
    type DateFilter,
    type SourceFilter,
} from "../lib/search-filters";
import {
    resultCountLabel,
    searchesLeftLabel,
    sourcesDownNotice,
} from "../lib/search-result-view";
import { SearchFilterBar, SearchFilterBox } from "./SearchFilters";

export type { SourceFilter };

/** The landing's source chips; Scholar is marked Pro (hidden from non-Pro while paid plans are). */
const LANDING_SOURCES: { value: SourceFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "nih", label: "NIH PMC" },
    { value: "springer", label: "Springer Nature" },
    { value: "europe-pmc", label: "Europe PMC" },
    { value: "crossref", label: "Crossref" },
    { value: "scholar", label: PAYMENTS_VISIBLE ? "Scholar · Pro" : "Scholar" },
];

const SEARCH_EXAMPLES = [
    "senolytics alzheimer",
    "GLP-1 cardiovascular outcomes",
    "base editing sickle cell",
    "gut microbiome parkinson",
];

const SEARCHES_FROM = [
    { label: "NIH PMC", color: "#0ab1ff" },
    { label: "Springer Nature", color: "#ff5aa9" },
    { label: "Europe PMC", color: "#22a06b" },
    { label: "Crossref", color: "#f5a524" },
    { label: SCHOLAR_SOURCE_LABEL, color: "#8b5cf6" },
];

function searchParamsFor(
    query: string,
    page: number,
    source: SourceFilter,
    date: DateFilter,
) {
    const params = new URLSearchParams({ q: query, page: String(page) });
    if (source !== "all") params.set("source", source);
    if (date !== "any") params.set("date", date);
    return params;
}

/** Errors a plan change or an account fixes. */
const LIMIT_CODES = new Set(["QUOTA_EXCEEDED", "DAILY_CAP_REACHED", "PRO_REQUIRED"]);

function resultKey(paper: SearchResult) {
    return `${paper.source}:${(paper.doi || paper.sourceId || paper.title).toLowerCase()}`;
}

function GoDeeper({ query, compact = false }: { query: string; compact?: boolean }) {
    return (
        <aside className={clsx(resultStyles.deeper, compact && resultStyles.deeperCompact)}>
            <span className={resultStyles.deeperEyebrow}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Go deeper
            </span>
            <h2 className={resultStyles.deeperTitle}>See what these papers add up to</h2>
            <p className={resultStyles.deeperText}>
                {compact
                    ? "A cited brief: what’s known, the gaps, and who’s working on them."
                    : "Discovery reads the open papers and writes a cited brief: what’s known, the gaps, and who’s working on them."}
            </p>
            <Link className={resultStyles.deeperButton} href={`/discover?q=${encodeURIComponent(query)}`}>
                Discover this topic
            </Link>
            {compact ? null : <span className={resultStyles.deeperNote}>Uses one Discovery run.</span>}
        </aside>
    );
}

type SearchPaperClientProps = {
    initialQuery: string;
    initialPage: string;
    initialSource: string;
    initialDate: string;
    landingIntro?: ReactNode;
    modeChrome?: ReactNode;
    skipInitialScroll?: boolean;
};

const SearchPaperClient = ({
    initialQuery,
    initialPage,
    initialSource,
    initialDate,
    landingIntro,
    modeChrome,
    skipInitialScroll = false,
}: SearchPaperClientProps) => {
    const qParam = initialQuery || null;
    const pageParam = initialPage || null;
    const sourceParam = parseSourceFilter(initialSource);
    const dateParam = parseDateFilter(initialDate);
    const router = useRouter();
    const { isLoggedIn, refresh, user } = useSession();

    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchValue, setSearchValue] = useState(qParam ?? "");
    const [loading, setLoading] = useState(Boolean(qParam));
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [pastSearchValue, setPastSearchValue] = useState("");
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [error, setError] = useState("");
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
    const [resultPlan, setResultPlan] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState("");
    // Sources that errored or timed out on this search.
    const [downSources, setDownSources] = useState<string[]>([]);
    const [searchTransitionActive, setSearchTransitionActive] = useState(false);
    const pageRef = useRef<HTMLDivElement>(null);
    // Bumped by every new search so a slow "show more" can't land on the wrong list.
    const searchRunRef = useRef(0);
    const searchTransitionStartedAtRef = useRef<number | null>(null);
    const searchTransitionTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);

    const activePage = Math.max(Number.parseInt(pageParam || "0", 10) || 0, 0);
    const activeSource = sourceParam;
    const activeDate = dateParam;
    const committedQuery = (pastSearchValue || qParam || "").trim();
    const hasCommittedSearch = Boolean(committedQuery);
    const filtered = activeSource !== "all" || activeDate !== "any";
    const displayError = error
        .replace(" Create a free account to continue.", "")
        .replace(" Upgrade to continue.", "");
    const isEditingSearch =
        searchValue.trim() !== committedQuery && searchValue.trim().length > 0;

    const { inlineSuggestion, clearInlineSuggestion } = useInlineSearchSuggestion(
        searchValue,
        {
            enabled: isLoggedIn && !loading && isEditingSearch,
            showStatusHint: false,
        },
    );

    const ghostCompletion = isEditingSearch ? inlineSuggestion : null;

    const scrollToTop = () => {
        const behavior = "smooth";
        pageRef.current?.scrollTo({ top: 0, behavior });
        const main = document.querySelector(".main-content");
        if (main instanceof HTMLElement) {
            main.scrollTo({ top: 0, behavior });
        }
        window.scrollTo({ top: 0, behavior });
    };

    useLayoutEffect(() => {
        if (skipInitialScroll) return;
        pageRef.current?.scrollTo({ top: 0, behavior: "auto" });
        const main = document.querySelector(".main-content");
        if (main instanceof HTMLElement) {
            main.scrollTo({ top: 0, behavior: "auto" });
        }
        window.scrollTo({ top: 0, behavior: "auto" });
    }, [skipInitialScroll]);

    // Preserve combined-page mode so refresh and share links stay on Search.
    const keepsSearchMode = () =>
        skipInitialScroll ||
        Boolean(modeChrome) ||
        new URLSearchParams(window.location.search).get("mode") === "search";

    const pushSearchParams = (
        query: string,
        page: number,
        source: SourceFilter = activeSource,
        date: DateFilter = activeDate,
    ) => {
        const params = searchParamsFor(query, page, source, date);
        if (keepsSearchMode()) params.set("mode", "search");
        router.push(`${window.location.pathname}?${params}`, { scroll: false });
    };

    const beginSearchTransition = useCallback(() => {
        if (searchTransitionTimerRef.current) {
            clearTimeout(searchTransitionTimerRef.current);
        }
        searchTransitionStartedAtRef.current = performance.now();
        setSearchTransitionActive(true);
    }, []);

    const finishSearchTransition = useCallback(() => {
        const startedAt = searchTransitionStartedAtRef.current;
        if (startedAt === null) return;
        const remaining = Math.max(0, 850 - (performance.now() - startedAt));
        searchTransitionTimerRef.current = setTimeout(() => {
            setSearchTransitionActive(false);
            searchTransitionStartedAtRef.current = null;
            searchTransitionTimerRef.current = null;
        }, remaining);
    }, []);

    useEffect(
        () => () => {
            if (searchTransitionTimerRef.current) {
                clearTimeout(searchTransitionTimerRef.current);
            }
        },
        [],
    );

    const handleSubmit = (queryOverride?: string): void => {
        const query = (queryOverride ?? searchValue).trim();
        if (!query) return;
        beginSearchTransition();

        if (
            queryOverride &&
            ghostCompletion &&
            searchQueriesMatch(queryOverride, ghostCompletion)
        ) {
            clearInlineSuggestion();
            pushSearchParams(queryOverride, 0, activeSource);
            return;
        }

        pushSearchParams(query, 0, activeSource);
    };

    const handleSearchValueChange: React.Dispatch<
        React.SetStateAction<string>
    > = (value) => {
        setSearchValue(value);
    };

    const handleAcceptGhost = () => {
        clearInlineSuggestion();
    };

    // Before a search, filters only change the URL (and stay on Search).
    const pushLandingFilters = (source: SourceFilter, date: DateFilter) => {
        const params = new URLSearchParams();
        if (keepsSearchMode()) params.set("mode", "search");
        if (source !== "all") params.set("source", source);
        if (date !== "any") params.set("date", date);
        const next = params.toString();
        router.push(
            next
                ? `${window.location.pathname}?${next}`
                : window.location.pathname,
            { scroll: false },
        );
    };

    const handleFiltersChange = (source: SourceFilter, date: DateFilter) => {
        const query = (pastSearchValue || qParam || searchValue).trim();
        if (!query) {
            pushLandingFilters(source, date);
            if (source !== activeSource && source !== "all") {
                window.setTimeout(() => {
                    document.getElementById("paper-search-input")?.focus();
                }, 0);
            }
            return;
        }
        pushSearchParams(query, 0, source, date);
        scrollToTop();
    };

    const doSearch = useCallback(
        async (
            query: string,
            page: number = 0,
            source: SourceFilter = "all",
            date: DateFilter = "any",
        ): Promise<void> => {
            const run = ++searchRunRef.current;
            const searchStartedAt = performance.now();
            const completeVisualTransition = async () => {
                const remaining = Math.max(
                    0,
                    850 - (performance.now() - searchStartedAt),
                );
                if (remaining > 0) {
                    await new Promise((resolve) =>
                        window.setTimeout(resolve, remaining),
                    );
                }
            };
            setLoading(true);
            setLoadingMore(false);
            setError("");
            setErrorCode(null);
            setMoreError("");
            setDownSources([]);

            const res = await fetch(
                `/api/search?${searchParamsFor(query, page, source, date)}`,
            );
            const data = await res.json().catch(() => ({}));
            void refresh();
            if (run !== searchRunRef.current) return;

            if (!res.ok) {
                setSearchResults([]);
                setTotalCount(0);
                setTotalPages(0);
                setError(data.error || "Search is temporarily unavailable.");
                setErrorCode(typeof data.code === "string" ? data.code : null);
                setQuotaRemaining(data.quota?.remaining ?? null);
                // Signed-in only: the pop-up ignores guests (their limit is daily).
                if (data.code === "QUOTA_EXCEEDED") showLimitReached("search", data.quota?.limit);
                await completeVisualTransition();
                setLoading(false);
                posthog.capture("search_blocked", {
                    status: res.status,
                    code: data.code,
                    source,
                });
                finishSearchTransition();
                return;
            }

            const results: SearchResult[] = Array.isArray(data.results)
                ? data.results
                : [];
            setSearchResults(results);
            setPastSearchValue(query);
            setTotalPages(Number(data.totalPages) || 0);
            setTotalCount(Number(data.totalCount) || 0);
            setCurrentPage(page);
            setQuotaRemaining(data.quota?.remaining ?? null);
            setResultPlan(typeof data.plan === "string" ? data.plan : null);
            setDownSources(Array.isArray(data.unavailable) ? data.unavailable : []);
            await completeVisualTransition();
            setLoading(false);
            finishSearchTransition();
            posthog.capture("search_completed", {
                source,
                date,
                result_count: results.length,
                cache_hit: Boolean(data.cacheHit),
            });
            logActivity({ kind: "search", detail: query });
        },
        [finishSearchTransition, refresh],
    );

    const loadMore = async () => {
        if (loadingMore || loading || currentPage >= totalPages - 1) return;
        const run = searchRunRef.current;
        const nextPage = currentPage + 1;
        setLoadingMore(true);
        setMoreError("");
        const res = await fetch(
            `/api/search?${searchParamsFor(committedQuery, nextPage, activeSource, activeDate)}`,
        );
        const data = await res.json().catch(() => ({}));
        void refresh();
        if (run !== searchRunRef.current) return;
        setLoadingMore(false);
        if (data.quota) setQuotaRemaining(data.quota.remaining ?? null);
        if (!res.ok) {
            setMoreError(data.error || "Couldn't load more results.");
            return;
        }
        const more: SearchResult[] = Array.isArray(data.results) ? data.results : [];
        setSearchResults((shown) => {
            const seen = new Set(shown.map(resultKey));
            return [...shown, ...more.filter((paper) => !seen.has(resultKey(paper)))];
        });
        setCurrentPage(nextPage);
        setTotalPages(Number(data.totalPages) || 0);
        if (Array.isArray(data.unavailable) && data.unavailable.length) {
            setDownSources((down) => [...new Set([...down, ...data.unavailable])]);
        }
        posthog.capture("search_more_loaded", {
            source: activeSource,
            date: activeDate,
            page: nextPage,
            result_count: more.length,
        });
    };

    useEffect(() => {
        setSearchValue(qParam ?? "");
        if (qParam) {
            doSearch(qParam, activePage, activeSource, activeDate);
        } else {
            searchRunRef.current += 1;
            setSearchResults([]);
            setPastSearchValue("");
            setTotalPages(0);
            setTotalCount(0);
            setCurrentPage(0);
            setLoading(false);
            setLoadingMore(false);
        }
    }, [qParam, activePage, activeSource, activeDate, doSearch]);

    useEffect(() => {
        const scrollContainer = pageRef.current;
        const mainContent = document.querySelector(".main-content");
        if (!scrollContainer && !(mainContent instanceof HTMLElement)) return;

        const handleScroll = () => {
            const pageTop = scrollContainer?.scrollTop ?? 0;
            const mainTop =
                mainContent instanceof HTMLElement ? mainContent.scrollTop : 0;
            const scrolled =
                pageTop > 240 || mainTop > 240 || window.scrollY > 240;
            setShowScrollTop(scrolled);
        };

        handleScroll();
        scrollContainer?.addEventListener("scroll", handleScroll, {
            passive: true,
        });
        if (mainContent instanceof HTMLElement) {
            mainContent.addEventListener("scroll", handleScroll, {
                passive: true,
            });
        }
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            scrollContainer?.removeEventListener("scroll", handleScroll);
            if (mainContent instanceof HTMLElement) {
                mainContent.removeEventListener("scroll", handleScroll);
            }
            window.removeEventListener("scroll", handleScroll);
        };
    }, [loading]);

    const activeQuery = pastSearchValue;
    const initialLoading =
        loading && searchResults.length === 0 && !pastSearchValue;
    const searchesLeft = searchesLeftLabel(quotaRemaining, resultPlan);
    const downNotice = error
        ? null
        : sourcesDownNotice(downSources, searchResults.length > 0);
    const hasMore =
        !error && searchResults.length > 0 && currentPage < totalPages - 1;
    const scholarOpen =
        resultPlan === "pro" || user?.plan === "pro" || Boolean(user?.isAdmin);
    const filterProps = {
        source: activeSource,
        date: activeDate,
        onChange: handleFiltersChange,
        scholarLocked: !scholarOpen,
    };

    return (
        <div
            className={clsx(styles.page, {
                [styles.pageLanding]: !hasCommittedSearch,
            })}
            data-search-paper-page
            data-search-landing={hasCommittedSearch ? undefined : "true"}
            data-page-scroll
            ref={pageRef}
        >
            <SearchLoadingOverlay
                visible={loading || searchTransitionActive}
                label="Scanning research databases…"
            />
            {showScrollTop && (
                <button
                    type="button"
                    className={styles.scrollTopButton}
                    onClick={scrollToTop}
                    aria-label="Scroll to top"
                >
                    <Image
                        className={styles.scrollTopIcon}
                        width={1000}
                        height={760}
                        src="/uparrowicon.svg"
                        alt=""
                    />
                </button>
            )}
            <div
                className={clsx(styles.searchbox, {
                    [styles.searchboxResults]: hasCommittedSearch,
                })}
            >
                {modeChrome ? (
                    <div
                        className={clsx(styles.modeChrome, {
                            [styles.modeChromeResults]: hasCommittedSearch,
                        })}
                    >
                        {modeChrome}
                    </div>
                ) : null}
                {landingIntro ? (
                    <div
                        className={clsx(styles.landingIntro, {
                            [styles.landingIntroHidden]: hasCommittedSearch,
                        })}
                    >
                        {landingIntro}
                    </div>
                ) : !hasCommittedSearch ? (
                    <div className={styles.findHead}>
                        <h1 className={styles.findTitle}>Find a paper</h1>
                        <p className={styles.findLead}>
                            Search NIH PMC, Springer Nature, Europe PMC, and
                            Crossref at once.
                            {PAYMENTS_VISIBLE ? " Google Scholar comes with Pro." : ""}
                        </p>
                    </div>
                ) : null}
                <SearchBar
                    searchValue={searchValue}
                    setSearchValue={handleSearchValueChange}
                    handleSubmit={handleSubmit}
                    className={clsx(styles.searchbar, hasCommittedSearch && resultStyles.resultsSearchbar)}
                    ghostCompletion={ghostCompletion}
                    onAcceptGhost={handleAcceptGhost}
                    inputId="paper-search-input"
                    // Results keep the blue Search button of the design; the
                    // active source shows in the filters instead.
                    accentSource={hasCommittedSearch ? "all" : activeSource}
                    searching={loading || searchTransitionActive}
                    footer={
                        hasCommittedSearch ? undefined : (
                            <>
                                <span className={styles.findFilterLabel}>
                                    Sources
                                </span>
                                {LANDING_SOURCES.filter(
                                    (source) =>
                                        source.value !== "scholar" ||
                                        PAYMENTS_VISIBLE ||
                                        scholarOpen,
                                ).map((source) => (
                                    <button
                                        key={source.value}
                                        type="button"
                                        className={styles.findSource}
                                        aria-pressed={activeSource === source.value}
                                        onClick={() =>
                                            handleFiltersChange(source.value, activeDate)
                                        }
                                    >
                                        {source.label}
                                    </button>
                                ))}
                                <label className={styles.findWhen}>
                                    When
                                    <select
                                        value={activeDate}
                                        onChange={(event) =>
                                            handleFiltersChange(
                                                activeSource,
                                                parseDateFilter(event.target.value),
                                            )
                                        }
                                    >
                                        {DATE_FILTERS.map((filter) => (
                                            <option
                                                key={filter.value}
                                                value={filter.value}
                                            >
                                                {filter.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        )
                    }
                />
                {!hasCommittedSearch ? (
                    <div className={styles.findExtras}>
                        {!searchValue.trim() ? (
                            <section
                                className={styles.findTry}
                                aria-labelledby="search-try"
                            >
                                <p id="search-try" className={styles.findLabel}>
                                    Try searching
                                </p>
                                <div className={styles.findExamples}>
                                    {SEARCH_EXAMPLES.map((example) => (
                                        <button
                                            key={example}
                                            type="button"
                                            className={styles.findExample}
                                            onClick={() => {
                                                handleSearchValueChange(example);
                                                document
                                                    .getElementById("paper-search-input")
                                                    ?.focus();
                                            }}
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                        <p className={styles.findSources}>
                            <span className={styles.findSourcesLabel}>Searches</span>
                            {SEARCHES_FROM.filter(
                                (source) =>
                                    source.label !== SCHOLAR_SOURCE_LABEL ||
                                    PAYMENTS_VISIBLE ||
                                    scholarOpen,
                            ).map((source) => (
                                <span key={source.label} className={styles.findSourceItem}>
                                    <span
                                        className={styles.findSourceDot}
                                        style={{ background: source.color }}
                                        aria-hidden="true"
                                    />
                                    {source.label}
                                </span>
                            ))}
                        </p>
                    </div>
                ) : null}
                {hasCommittedSearch ? (
                    <div className={resultStyles.results}>
                        <SearchFilterBar {...filterProps} />
                        <SearchFilterBox {...filterProps} />

                        {!initialLoading ? (
                            <div className={resultStyles.countRow}>
                                <p className={resultStyles.count} aria-live="polite">
                                    <strong>
                                        {error
                                            ? "No results"
                                            : resultCountLabel(totalCount, searchResults.length)}
                                    </strong>
                                    <span className={resultStyles.countQuery}>
                                        {" "}for &ldquo;{committedQuery}&rdquo;
                                    </span>
                                    <span className={resultStyles.countDate}>
                                        {" "}· {dateFilterLabel(activeDate).toLowerCase()}
                                    </span>
                                    {filtered ? (
                                        <span className={resultStyles.countClear}>
                                            {" "}·{" "}
                                            <button
                                                type="button"
                                                onClick={() => handleFiltersChange("all", "any")}
                                            >
                                                Clear filters
                                            </button>
                                        </span>
                                    ) : null}
                                </p>
                                {searchesLeft ? (
                                    <span className={resultStyles.quota}>{searchesLeft}</span>
                                ) : null}
                            </div>
                        ) : null}

                        {downNotice && !initialLoading ? (
                            <p className={resultStyles.sourceNotice} role="status">
                                {downNotice}
                            </p>
                        ) : null}

                        <div className={resultStyles.grid}>
                            <div className={resultStyles.main}>
                                {initialLoading ? (
                                    <div className={resultStyles.skeleton} aria-hidden="true">
                                        {[0, 1, 2].map((item) => (
                                            <div
                                                key={item}
                                                className={`${resultStyles.skeletonRow} loading-skeleton`}
                                            />
                                        ))}
                                    </div>
                                ) : error ? (
                                    <div className={resultStyles.notice}>
                                        <p>{displayError}</p>
                                        {errorCode && LIMIT_CODES.has(errorCode) ? (
                                            <Link
                                                className={resultStyles.noticeCta}
                                                href={
                                                    !isLoggedIn
                                                        ? "/signup"
                                                        : PAYMENTS_VISIBLE
                                                          ? "/pricing"
                                                          : NEED_MORE_HREF
                                                }
                                            >
                                                {!isLoggedIn
                                                    ? "Create a free account"
                                                    : PAYMENTS_VISIBLE
                                                      ? "View plan options"
                                                      : NEED_MORE_LABEL}
                                            </Link>
                                        ) : null}
                                    </div>
                                ) : searchResults.length === 0 && downNotice ? null : searchResults.length === 0 ? (
                                    <div className={resultStyles.notice}>
                                        <p>
                                            No papers matched
                                            {filtered ? " these filters" : ""}. Try
                                            different words
                                            {filtered ? ", another source, or a wider date range" : ""}.
                                        </p>
                                        {filtered ? (
                                            <button
                                                type="button"
                                                className={resultStyles.noticeCta}
                                                onClick={() => handleFiltersChange("all", "any")}
                                            >
                                                Clear filters
                                            </button>
                                        ) : null}
                                    </div>
                                ) : (
                                    <SearchResults
                                        searchResults={searchResults}
                                        searchValue={activeQuery}
                                        inlineAside={<GoDeeper query={committedQuery} compact />}
                                    />
                                )}
                            </div>
                            <div className={resultStyles.side}>
                                <GoDeeper query={committedQuery} />
                            </div>
                        </div>

                        {hasMore ? (
                            <button
                                type="button"
                                className={resultStyles.more}
                                onClick={loadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Loading more…" : "Show more results"}
                            </button>
                        ) : null}
                        {moreError ? (
                            <p className={resultStyles.moreError} role="alert">
                                {moreError}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default SearchPaperClient;
