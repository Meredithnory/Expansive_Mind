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
import SearchResults from "../components/SearchResults";
import { SearchLoadingOverlay } from "../components/Loading";
import { searchQueriesMatch } from "../lib/search-suggest";
import { useInlineSearchSuggestion } from "../lib/use-inline-search-suggestion";
import Image from "next/image";
import clsx from "clsx";
import type { ContentAccessPolicy } from "../lib/content-access-policy";
import { useSession } from "../lib/use-session";
import Link from "next/link";
import posthog from "posthog-js";
import DatabaseMind from "../components/DatabaseMind";

export type SourceFilter = "all" | "nih" | "springer" | "scholar";
type DateFilter = "any" | "this-year" | "2-years" | "5-years" | "10-years";

const SOURCE_FILTERS: {
    value: SourceFilter;
    label: string;
    description: string;
    shortName: string;
}[] = [
    {
        value: "all",
        label: "All sources",
        shortName: "All",
        description: "NIH and Springer Nature open access",
    },
    {
        value: "nih",
        label: "NIH PubMed Central",
        shortName: "NIH",
        description: "PubMed Central open access",
    },
    {
        value: "springer",
        label: "Springer Nature",
        shortName: "Springer",
        description: "Open access publications",
    },
    {
        value: "scholar",
        label: "Google Scholar",
        shortName: "Scholar",
        description: "Ranked by relevance",
    },
];

const FILTER_OPTION_CLASS: Record<SourceFilter, string> = {
    all: styles.filterOptionAll,
    nih: styles.filterOptionNih,
    springer: styles.filterOptionSpringer,
    scholar: styles.filterOptionScholar,
};

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
    { value: "any", label: "Any time" },
    { value: "this-year", label: "This year" },
    { value: "2-years", label: "Last 2 years" },
    { value: "5-years", label: "Last 5 years" },
    { value: "10-years", label: "Last 10 years" },
];

interface SearchResult {
    sourceId: string;
    doi?: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string | string[] | null;
    matchTier?: "title" | "abstract" | "body";
    source?: "nih" | "nature" | "scholar";
    sourceLabel?: string;
    sourceUrl?: string;
    contentLabel?: "Abstract" | "Search snippet";
    access?: ContentAccessPolicy;
    citationCount?: number;
    citationSource?: "crossref" | "europepmc" | "scholar";
}

const parseSourceFilter = (value: string | null): SourceFilter => {
    if (value === "nih" || value === "springer" || value === "scholar") {
        return value;
    }
    return "all";
};

const parseDateFilter = (value: string | null): DateFilter => {
    if (
        value === "this-year" ||
        value === "2-years" ||
        value === "5-years" ||
        value === "10-years"
    ) {
        return value;
    }
    return "any";
};

type SearchPaperClientProps = {
    initialQuery: string;
    initialPage: string;
    initialSource: string;
    initialDate: string;
    landingIntro: ReactNode;
};

const SearchPaperClient = ({
    initialQuery,
    initialPage,
    initialSource,
    initialDate,
    landingIntro,
}: SearchPaperClientProps) => {
    const qParam = initialQuery || null;
    const pageParam = initialPage || null;
    const sourceParam = parseSourceFilter(initialSource);
    const dateParam = parseDateFilter(initialDate);
    const router = useRouter();
    const { isLoggedIn, refresh } = useSession();

    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchValue, setSearchValue] = useState(qParam ?? "");
    const [loading, setLoading] = useState(Boolean(qParam));
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [pastSearchValue, setPastSearchValue] = useState("");
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [error, setError] = useState("");
    const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [searchTransitionActive, setSearchTransitionActive] = useState(false);
    const pageRef = useRef<HTMLDivElement>(null);
    const previousPageRef = useRef<number | null>(null);
    const searchTransitionStartedAtRef = useRef<number | null>(null);
    const searchTransitionTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);

    const activePage = Math.max(Number.parseInt(pageParam || "0", 10) || 0, 0);
    const activeSource = sourceParam;
    const activeDate = dateParam;
    const committedQuery = (pastSearchValue || qParam || "").trim();
    const hasCommittedSearch = Boolean(committedQuery);
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
        pageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    useLayoutEffect(() => {
        pageRef.current?.scrollTo({ top: 0, behavior: "auto" });
        window.scrollTo({ top: 0, behavior: "auto" });
    }, []);

    const pushSearchParams = (
        query: string,
        page: number,
        source: SourceFilter = activeSource,
        date: DateFilter = activeDate,
    ) => {
        const params = new URLSearchParams({
            q: query,
            page: String(page),
        });

        if (source !== "all") {
            params.set("source", source);
        }
        if (date !== "any") {
            params.set("date", date);
        }

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

    const handleSourceChange = (source: SourceFilter) => {
        const query = (pastSearchValue || qParam || searchValue).trim();
        if (!query) {
            const params = new URLSearchParams();
            if (source !== "all") {
                params.set("source", source);
            }
            if (activeDate !== "any") {
                params.set("date", activeDate);
            }
            const next = params.toString();
            router.push(
                next
                    ? `${window.location.pathname}?${next}`
                    : window.location.pathname,
                { scroll: false },
            );
            window.setTimeout(() => {
                document.getElementById("paper-search-input")?.focus();
            }, 0);
            return;
        }

        pushSearchParams(query, 0, source);
        if (window.matchMedia("(max-width: 720px)").matches) {
            setFiltersExpanded(false);
        }
        scrollToTop();
    };

    const handleDateChange = (date: DateFilter) => {
        const query = (pastSearchValue || qParam || searchValue).trim();
        if (!query) return;
        pushSearchParams(query, 0, activeSource, date);
        if (window.matchMedia("(max-width: 720px)").matches) {
            setFiltersExpanded(false);
        }
        scrollToTop();
    };

    const doSearch = useCallback(
        async (
            query: string,
            page: number = 0,
            source: SourceFilter = "all",
            date: DateFilter = "any",
        ): Promise<void> => {
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
            setError("");
            const params = new URLSearchParams({
                q: query,
                page: String(page),
            });

            if (source !== "all") {
                params.set("source", source);
            }
            if (date !== "any") {
                params.set("date", date);
            }

            const res = await fetch(`/api/search?${params}`);
            const data = await res.json();
            void refresh();

            if (!res.ok) {
                setSearchResults([]);
                setError(data.error || "Search is temporarily unavailable.");
                setQuotaRemaining(data.quota?.remaining ?? null);
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

            setSearchResults(Array.isArray(data.results) ? data.results : []);
            setPastSearchValue(query);
            setTotalPages(data.totalPages);
            setCurrentPage(page);
            setQuotaRemaining(data.quota?.remaining ?? null);
            await completeVisualTransition();
            setLoading(false);
            finishSearchTransition();
            posthog.capture("search_completed", {
                source,
                result_count: Array.isArray(data.results)
                    ? data.results.length
                    : 0,
                cache_hit: Boolean(data.cacheHit),
            });
        },
        [finishSearchTransition, refresh],
    );

    useEffect(() => {
        setSearchValue(qParam ?? "");
        if (qParam) {
            doSearch(qParam, activePage, activeSource, activeDate);
        } else {
            setSearchResults([]);
            setPastSearchValue("");
            setTotalPages(0);
            setCurrentPage(0);
            setLoading(false);
        }
    }, [qParam, activePage, activeSource, activeDate, doSearch]);

    useEffect(() => {
        if (loading || !qParam) return;

        if (
            previousPageRef.current !== null &&
            previousPageRef.current !== activePage
        ) {
            scrollToTop();
        }

        previousPageRef.current = activePage;
    }, [activePage, loading, qParam]);

    useEffect(() => {
        const scrollContainer = pageRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            const scrolled =
                scrollContainer.scrollTop > 240 || window.scrollY > 240;
            setShowScrollTop(scrolled);
        };

        handleScroll();
        scrollContainer.addEventListener("scroll", handleScroll, {
            passive: true,
        });
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            scrollContainer.removeEventListener("scroll", handleScroll);
            window.removeEventListener("scroll", handleScroll);
        };
    }, [loading]);

    const activeQuery = pastSearchValue;
    const initialLoading =
        loading && searchResults.length === 0 && !pastSearchValue;

    return (
        <div
            className={clsx(styles.page, {
                [styles.pageLanding]: !hasCommittedSearch,
            })}
            data-search-paper-page
            data-page-scroll
            ref={pageRef}
        >
            {!hasCommittedSearch ? (
                <div className={styles.landingAura} aria-hidden="true" />
            ) : null}
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
                <div
                    className={clsx(styles.landingIntro, {
                        [styles.landingIntroHidden]: hasCommittedSearch,
                    })}
                >
                    {landingIntro}
                </div>
                <SearchBar
                    searchValue={searchValue}
                    setSearchValue={handleSearchValueChange}
                    handleSubmit={handleSubmit}
                    className={styles.searchbar}
                    ghostCompletion={ghostCompletion}
                    onAcceptGhost={handleAcceptGhost}
                    inputId="paper-search-input"
                    accentSource={activeSource}
                    searching={loading || searchTransitionActive}
                />
                <div
                    className={clsx(styles.databaseCatalog, {
                        [styles.databaseCatalogHidden]: hasCommittedSearch,
                    })}
                >
                    <DatabaseMind
                        activeSource={activeSource}
                        onSelect={handleSourceChange}
                    />
                    <ul className={styles.landingProof}>
                        <li>
                            <span className={styles.proofDot} data-tone="pink" />
                            Free to explore
                        </li>
                        <li>
                            <span className={styles.proofDot} data-tone="violet" />
                            Chat with any paper
                        </li>
                        <li>
                            <span className={styles.proofDot} data-tone="blue" />
                            Understand it. Share it.
                        </li>
                    </ul>
                </div>
                <div
                    className={clsx(styles.searchLayout, {
                        [styles.searchLayoutHidden]: !hasCommittedSearch,
                    })}
                >
                    <aside
                        className={clsx(styles.filterSidebar, {
                            [styles.filterSidebarHidden]: !hasCommittedSearch,
                            [styles.filterSidebarCollapsed]: !filtersExpanded,
                        })}
                    >
                        <div className={styles.filterHeader}>
                            <div className={styles.filterHeaderTop}>
                                <h2 className={styles.filterTitle}>Filters</h2>
                                <span className={styles.filterCountDesktop}>
                                    2
                                </span>
                                <button
                                    type="button"
                                    className={styles.filterToggle}
                                    aria-expanded={filtersExpanded}
                                    aria-controls="source-filter-options"
                                    onClick={() =>
                                        setFiltersExpanded((expanded) => !expanded)
                                    }
                                >
                                    <span>
                                        {filtersExpanded ? "Hide" : "Show"} filters
                                    </span>
                                    <span
                                        className={clsx(styles.filterChevron, {
                                            [styles.filterChevronExpanded]:
                                                filtersExpanded,
                                        })}
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                            <p
                                className={clsx(styles.filterLegend, {
                                    [styles.filterLegendCollapsed]:
                                        !filtersExpanded,
                                })}
                            >
                                Source and publication date
                            </p>
                        </div>
                        <div
                            id="source-filter-options"
                            className={clsx(styles.filterList, {
                                [styles.filterListCollapsed]: !filtersExpanded,
                            })}
                        >
                            {SOURCE_FILTERS.map((filter) => {
                                const isSelected =
                                    activeSource === filter.value;
                                const isFiltered =
                                    isSelected && filter.value !== "all";

                                return (
                                    <button
                                        key={filter.value}
                                        type="button"
                                        className={clsx(
                                            styles.filterOption,
                                            FILTER_OPTION_CLASS[filter.value],
                                            {
                                                [styles.filterOptionActive]:
                                                    isFiltered,
                                            },
                                        )}
                                        onClick={() =>
                                            handleSourceChange(filter.value)
                                        }
                                        aria-pressed={isSelected}
                                    >
                                        <span className={styles.filterOptionRow}>
                                            <span
                                                className={styles.filterDot}
                                                aria-hidden="true"
                                            />
                                            <span className={styles.filterLabel}>
                                                {filter.label}
                                            </span>
                                            {isFiltered && (
                                                <span
                                                    className={
                                                        styles.filterActiveBadge
                                                    }
                                                >
                                                    Active
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={styles.filterDescription}
                                        >
                                            {filter.description}
                                        </span>
                                    </button>
                                );
                            })}
                            <div className={styles.dateFilter}>
                                <span className={styles.dateFilterTitle}>
                                    Published
                                </span>
                                <div className={styles.dateOptions}>
                                    {DATE_FILTERS.map((filter) => (
                                        <button
                                            key={filter.value}
                                            type="button"
                                            className={clsx(
                                                styles.dateOption,
                                                activeDate === filter.value &&
                                                    styles.dateOptionActive,
                                            )}
                                            onClick={() =>
                                                handleDateChange(filter.value)
                                            }
                                            aria-pressed={
                                                activeDate === filter.value
                                            }
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>

                    {hasCommittedSearch && (
                    <div className={styles.resultsContainer}>
                        {error && (
                            <div className={styles.emptyResults}>
                                <span>{displayError}</span>
                                {!isLoggedIn && (
                                    <Link
                                        className={styles.limitCta}
                                        href="/signup"
                                    >
                                        Create a free account
                                    </Link>
                                )}
                                {isLoggedIn && (
                                    <Link
                                        className={styles.limitCta}
                                        href="/pricing"
                                    >
                                        View plan options
                                    </Link>
                                )}
                            </div>
                        )}
                        {!initialLoading && (
                            <div className={styles.showingResults}>
                                Showing results for &ldquo;{committedQuery}
                                &rdquo;
                                {activeSource !== "all" && (
                                    <span className={styles.activeFilterLabel}>
                                        {" "}
                                        ·{" "}
                                        {
                                            SOURCE_FILTERS.find(
                                                (filter) =>
                                                    filter.value ===
                                                    activeSource,
                                            )?.label
                                        }
                                    </span>
                                )}
                                {activeDate !== "any" && (
                                    <span className={styles.activeFilterLabel}>
                                        {" "}
                                        ·{" "}
                                        {
                                            DATE_FILTERS.find(
                                                (filter) =>
                                                    filter.value === activeDate,
                                            )?.label
                                        }
                                    </span>
                                )}
                                {quotaRemaining !== null && (
                                    <span className={styles.activeFilterLabel}>
                                        {" "}
                                        · {quotaRemaining} searches remaining
                                    </span>
                                )}
                                {committedQuery && (
                                    <Link
                                        className={styles.synthesizeCta}
                                        href={`/discover?q=${encodeURIComponent(committedQuery)}`}
                                    >
                                        Synthesize this topic
                                    </Link>
                                )}
                            </div>
                        )}

                        {initialLoading ? (
                            <div
                                className={styles.resultsSkeleton}
                                aria-hidden="true"
                            >
                                {[0, 1, 2].map((item) => (
                                    <div
                                        key={item}
                                        className={`${styles.resultSkeletonCard} loading-skeleton`}
                                    />
                                ))}
                            </div>
                        ) : error ? null : searchResults.length === 0 ? (
                            <div className={styles.emptyResults}>
                                No results found for this source filter.
                            </div>
                        ) : (
                            <SearchResults
                                searchResults={searchResults}
                                searchValue={activeQuery}
                            />
                        )}

                        {!initialLoading && totalPages > 0 && (
                            <div className={styles.pagination}>
                                    <button
                                        className={styles.prevbutton}
                                        type="button"
                                        aria-label="Previous results page"
                                        disabled={currentPage === 0 || loading}
                                        onClick={() =>
                                            pushSearchParams(
                                                pastSearchValue,
                                                currentPage - 1,
                                                activeSource,
                                            )
                                        }
                                    >
                                        <Image
                                            className={styles.icon}
                                            width={1000}
                                            height={760}
                                            src="/previcon.svg"
                                            alt=""
                                        />
                                    </button>

                                    <div className={styles.currentpage}>
                                        Page {currentPage + 1} of {totalPages}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Next results page"
                                        disabled={
                                            currentPage >= totalPages - 1 ||
                                            loading
                                        }
                                        onClick={() =>
                                            pushSearchParams(
                                                pastSearchValue,
                                                currentPage + 1,
                                                activeSource,
                                            )
                                        }
                                        className={styles.nextbutton}
                                    >
                                        <Image
                                            className={styles.icon}
                                            width={1000}
                                            height={760}
                                            src="/nexticon.svg"
                                            alt=""
                                        />
                                    </button>
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPaperClient;
