"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./paperchatbot.module.scss";
import Paperbox from "../../../components/paperchatbot/Paperbox";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
    FormattedPaper,
    PaperFigure,
    RelatedResearchArticle,
} from "../../../api/general-interfaces";
import { LoadingOverlay } from "../../../components/Loading";
import Link from "next/link";
import {
    buildChatMessages,
    ChatMessage,
    FigureAnalysisRequest,
    PendingChatAttachment,
} from "../../../lib/chat-messages";
import {
    buildPaperPath,
    getSourceByDatabase,
} from "../../../lib/paper-sources";
import {
    citationFromLineRange,
    type PaperCitation,
} from "../../../lib/paper-citation";
import { parseLineRange } from "../../../lib/paper-lines";
import { loadBrowserFullText } from "../../../lib/browser-paper";
import { paperChatMode } from "../../../lib/chat-access";
import type { PaperTool } from "../../../lib/region-capture";
import type { PaperHighlightRecord } from "../../../lib/paper-highlights";
import {
    consumeCiteFocusSource,
    findCitedSourceInPaper,
} from "../../../lib/cite-source-focus";
import ResearchBot from "../../../components/ResearchBot";

const ResponsiveChatPanel = dynamic(
    () => import("../../../components/paperchatbot/ResponsiveChatPanel"),
    {
        loading: () => (
            <div
                className={`${styles.chatSkeleton} loading-skeleton`}
                role="status"
                aria-label="Loading paper assistant"
            />
        ),
    },
);

const BriefModal = dynamic(
    () => import("../../../components/paperchatbot/BriefModal"),
    {
        loading: () => (
            <div className={styles.redirectOverlay} role="status">
                <div className={styles.redirectCard}>
                    Preparing shareable summary…
                </div>
            </div>
        ),
    },
);

const SharePaperModal = dynamic(
    () => import("../../../components/paperchatbot/SharePaperModal"),
);

const REDIRECT_DELAY_SECONDS = 15;

const NOTICE_COPY: Record<RelatedResearchArticle["noticeType"], string> = {
    correction:
        "This page is a correction notice, not the full research article.",
    erratum: "This page is an erratum, not the full research article.",
    retraction: "This page is a retraction notice.",
    "expression-of-concern":
        "This page is an expression of concern notice.",
};

const BackArrowIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        {...props}
    >
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);

const PencilIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
        <path d="M4 20h6M14.5 5.5l4 4L9 19H5v-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

const SUMMARY_QUESTION =
    "Summarize this paper in plain language: the question, what was done, the main findings, and the key limitations.";

const ShareIcon = () => (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <circle cx="6.5" cy="12" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="7" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="17" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
            d="M8.4 11.1 14.5 8.1M8.4 12.9 14.5 15.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
        />
    </svg>
);

type PaperChatClientProps = {
    database: string;
    paperId: string;
    qParam: string | null;
    focusExcerpt: string | null;
    locateMethod: boolean;
    requestedIdName: string | null;
    citeFocus: boolean;
    focusLines?: string | null;
    /** Opened from a Discover report (`?from=report`). */
    fromReport?: boolean;
    /** The paper's number in that report (`?paper=3`). */
    reportPaper?: number | null;
    /** The report gap the paper was opened from (`?gap=1`). */
    reportGap?: number | null;
};

const PaperChatClient = ({
    database,
    paperId,
    qParam,
    focusExcerpt,
    locateMethod,
    requestedIdName,
    citeFocus,
    focusLines = null,
    fromReport = false,
    reportPaper = null,
    reportGap = null,
}: PaperChatClientProps) => {
    const router = useRouter();
    const sourceConfig = getSourceByDatabase(database);
    const idName = requestedIdName || sourceConfig?.defaultIdName || "pmcid";

    const [browserBodyLoading, setBrowserBodyLoading] = useState(false);
    const [researchPaper, setResearchPaper] = useState<FormattedPaper | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [redirectNotice, setRedirectNotice] =
        useState<RelatedResearchArticle | null>(null);
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(
        REDIRECT_DELAY_SECONDS,
    );
    const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
    const [authenticated, setAuthenticated] = useState(false);
    const [canAnalyzeFigures, setCanAnalyzeFigures] = useState(false);
    const [figureRequest, setFigureRequest] =
        useState<FigureAnalysisRequest | null>(null);
    const [focusCitation, setFocusCitation] = useState<PaperCitation | null>(
        null,
    );
    const [focusRequestId, setFocusRequestId] = useState(0);
    const [activeTool, setActiveTool] = useState<PaperTool | null>(null);
    const [pendingAttachment, setPendingAttachment] =
        useState<PendingChatAttachment | null>(null);
    const [pendingInsert, setPendingInsert] = useState<PaperCitation | null>(
        null,
    );
    const [highlights, setHighlights] = useState<PaperHighlightRecord[]>([]);
    const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
    const [showHighlightsRequest, setShowHighlightsRequest] = useState(0);
    const [briefOpen, setBriefOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const shareMenuRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const toolsRef = useRef<HTMLDivElement>(null);

    // Where the reader toolbar ends on screen when it sticks (phones and
    // tablets), so the paper's Contents bar and section jumps sit below it.
    useEffect(() => {
        const tools = toolsRef.current;
        const page = pageRef.current;
        if (!tools || !page) return;
        const update = () => {
            const sticky = getComputedStyle(tools).position === "sticky";
            const top = sticky ? parseFloat(getComputedStyle(tools).top) || 0 : 0;
            const offset = sticky ? Math.ceil(top + tools.getBoundingClientRect().height) : 0;
            page.style.setProperty("--paper-toolbar-bottom", `${offset}px`);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(tools);
        window.addEventListener("resize", update);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);
    const [canNativeShare, setCanNativeShare] = useState(false);

    useEffect(() => {
        setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    }, []);

    // The Share menu closes like the nav's More menu: outside tap or Escape.
    useEffect(() => {
        if (!shareMenuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!shareMenuRef.current?.contains(event.target as Node)) setShareMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setShareMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [shareMenuOpen]);

    const fetchPaperInfo = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        setRedirectNotice(null);
        setNoticeDismissed(false);
        setSecondsRemaining(REDIRECT_DELAY_SECONDS);
        setAllMessages([]);
        setActiveTool(null);
        setPendingAttachment(null);
        setPendingInsert(null);
        try {
            const params = new URLSearchParams();
            params.append("database", database);
            params.append("paperId", paperId);
            params.append("idName", idName);

            const res = await fetch(`/api/paper?${params}`, {
                method: "GET",
            });
            const data = await res.json();

            if (!res.ok || !data.paper) {
                setResearchPaper(null);
                setLoadError(data.error || "Unable to load this paper.");
                return;
            }

            const related = data.paper.relatedResearchArticle;
            const normalizedPaperId = paperId.replace(/^PMC/i, "").replace(/\D/g, "");
            setResearchPaper(data.paper);
            setAuthenticated(Boolean(data.authenticated));
            setCanAnalyzeFigures(Boolean(data.canAnalyzeFigures));
            setAllMessages(buildChatMessages(data.messages || []));

            if (
                related &&
                (related.noticeType === "correction" ||
                    related.noticeType === "erratum") &&
                related.pmcid !== normalizedPaperId
            ) {
                setRedirectNotice(related);
            }
        } catch {
            console.error("Paper request failed");
            setResearchPaper(null);
            setLoadError("Unable to load this paper.");
        } finally {
            setLoading(false);
        }
    }, [database, idName, paperId]);

    useEffect(() => {
        if (database && paperId) {
            fetchPaperInfo();
        }
    }, [database, paperId, fetchPaperInfo]);

    // Papers whose license keeps the body off our servers load it in the
    // reader's browser, straight from NIH, for reading only.
    const browserSource =
        researchPaper && !researchPaper.access.canDisplayFullText
            ? researchPaper.browserFullText
            : undefined;
    const browserPmcid = browserSource?.pmcid;
    useEffect(() => {
        if (!browserSource) return;
        const controller = new AbortController();
        setBrowserBodyLoading(true);
        loadBrowserFullText(browserSource, controller.signal)
            .then((sections) => {
                if (!sections || controller.signal.aborted) return;
                setResearchPaper((current) =>
                    current && current.browserFullText?.pmcid === browserPmcid
                        ? { ...current, paper: sections, bodyLoadedInBrowser: true }
                        : current,
                );
            })
            .catch(() => {
                // The abstract view stays in place.
            })
            .finally(() => {
                if (!controller.signal.aborted) setBrowserBodyLoading(false);
            });
        return () => controller.abort();
        // Load once per paper; later state updates reuse the same source.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [browserPmcid]);

    // ?lines=12-15 (group posts): open at a line range without putting the
    // passage text in the link.
    useEffect(() => {
        if (!focusLines || !researchPaper || loading) return;
        const range = parseLineRange(focusLines);
        if (!range) return;
        const citation = citationFromLineRange(researchPaper, range.start, range.end);
        if (citation) {
            setFocusCitation(citation);
            setFocusRequestId((current) => current + 1);
        }
    }, [focusLines, researchPaper, loading]);

    useEffect(() => {
        if (!citeFocus || !researchPaper || loading) return;

        const source = consumeCiteFocusSource();
        if (source) {
            const citation = findCitedSourceInPaper(researchPaper, source);
            if (citation && citation.lines.join(" ").trim()) {
                setFocusCitation(citation);
                setFocusRequestId((current) => current + 1);
            }
        }

        // Drop citeFocus from the URL so a refresh does not keep re-applying.
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has("citeFocus")) {
                url.searchParams.delete("citeFocus");
                const next = `${url.pathname}${url.search}${url.hash}`;
                router.replace(next, { scroll: false });
            }
        } catch {
            // Ignore malformed URL edge cases.
        }
    }, [citeFocus, researchPaper, loading, router]);

    const buildRedirectPath = useCallback((related: RelatedResearchArticle) => {
        const basePath = buildPaperPath("nih", related.pmcid);
        const params = new URLSearchParams();
        if (qParam) {
            params.set("q", qParam);
        }
        const query = params.toString();
        return query ? `${basePath}?${query}` : basePath;
    }, [qParam]);

    const handleOpenFullArticle = () => {
        if (!redirectNotice) return;
        router.replace(buildRedirectPath(redirectNotice));
    };

    const handleReadNotice = () => {
        setNoticeDismissed(true);
    };

    useEffect(() => {
        if (!redirectNotice || noticeDismissed) return;

        let remaining = REDIRECT_DELAY_SECONDS;
        setSecondsRemaining(remaining);

        const countdown = window.setInterval(() => {
            remaining -= 1;
            setSecondsRemaining(remaining);

            if (remaining <= 0) {
                window.clearInterval(countdown);
                router.replace(buildRedirectPath(redirectNotice));
            }
        }, 1000);

        return () => window.clearInterval(countdown);
    }, [redirectNotice, noticeDismissed, router, buildRedirectPath]);

    const handleAnalyzeFigure = (figure: PaperFigure) => {
        setFigureRequest({
            requestId: crypto.randomUUID(),
            figure,
        });
    };

    const chatMode = researchPaper ? paperChatMode(researchPaper) : null;
    const canUseChatTools =
        authenticated &&
        Boolean(researchPaper && (chatMode || canAnalyzeFigures));
    const canSharePaper =
        authenticated && Boolean(researchPaper?.access.canPersistContent);
    const persistHighlights =
        authenticated && researchPaper?.access.canPersistContent
            ? {
                  database,
                  paperId: researchPaper.paperId,
                  idName: researchPaper.idName,
              }
            : null;

    const toggleTool = (tool: PaperTool) => {
        setActiveTool((current) => (current === tool ? null : tool));
    };

    const shareNatively = async () => {
        if (!researchPaper || typeof navigator.share !== "function") return;
        try {
            await navigator.share({
                title: researchPaper.title || "Research paper",
                url: window.location.href,
            });
        } catch {
            // Dismissed or unsupported: nothing to do.
        }
    };

    const handleHighlight = (citation: PaperCitation) => {
        setPendingInsert(citation);
    };

    // A report link opened in a new tab has no page to go back to.
    const handleBack = () => {
        if (fromReport && window.history.length <= 1) {
            router.push("/discover");
            return;
        }
        router.back();
    };

    const handleLocateCitation = useCallback((citation: PaperCitation) => {
        setFocusCitation(citation);
        setFocusRequestId((current) => current + 1);
    }, []);

    useEffect(() => {
        if (!activeTool) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setActiveTool(null);
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [activeTool]);

    const showNoticePrompt = redirectNotice && !noticeDismissed;
    const initialLoading = loading && !researchPaper;

    const shareOptions = [
        ...(canSharePaper
            ? [{
                  id: "snapshot",
                  label: "Paper + your highlights",
                  detail: "A read-only copy for another researcher",
                  run: () => setShareOpen(true),
              }]
            : []),
        ...(researchPaper?.access.canSendToAI
            ? [{
                  id: "summary",
                  label: "Summary link",
                  detail: "A short summary anyone can open",
                  run: () => setBriefOpen(true),
              }]
            : []),
        ...(canNativeShare && researchPaper
            ? [{
                  id: "native",
                  label: "Share page…",
                  detail: "Send this page with your phone or computer",
                  run: () => void shareNatively(),
              }]
            : []),
    ];

    return (
        <div className={styles.page} ref={pageRef} data-paper-reader="">
            <LoadingOverlay visible={loading} label="Preparing this paper…" />
            {researchPaper && briefOpen && (
                <BriefModal
                    paper={researchPaper}
                    open={briefOpen}
                    onClose={() => setBriefOpen(false)}
                />
            )}
            {researchPaper && shareOpen && (
                <SharePaperModal
                    paper={researchPaper}
                    open={shareOpen}
                    onClose={() => setShareOpen(false)}
                />
            )}
            {showNoticePrompt && (
                <div className={styles.redirectOverlay}>
                    <div className={styles.redirectCard}>
                        <p className={styles.redirectEyebrow}>Notice</p>
                        <h1 className={styles.redirectTitle}>
                            {NOTICE_COPY[redirectNotice.noticeType]}
                        </h1>
                        <p className={styles.redirectBody}>
                            You can read this notice here, or open the full
                            research article:
                        </p>
                        <p className={styles.redirectPaperTitle}>
                            {redirectNotice.title}
                        </p>
                        <div className={styles.redirectActions}>
                            <button
                                className={styles.redirectButtonSecondary}
                                onClick={handleReadNotice}
                            >
                                Read this notice
                            </button>
                            <button
                                className={styles.redirectButton}
                                onClick={handleOpenFullArticle}
                            >
                                Open full article
                            </button>
                        </div>
                        <p className={styles.redirectHint}>
                            Opening the full article automatically in{" "}
                            {secondsRemaining} second
                            {secondsRemaining === 1 ? "" : "s"}.
                        </p>
                    </div>
                </div>
            )}
            <div className={styles.toolsbox} ref={toolsRef}>
                <div className={styles.searcharea}>
                    <button
                        type="button"
                        className={styles.searchbutton}
                        onClick={handleBack}
                        aria-label={fromReport ? "Back to your report" : "Back"}
                    >
                        <BackArrowIcon />
                        <span className={styles.text}>
                            {fromReport ? "Your report" : "Back"}
                        </span>
                    </button>
                    {fromReport && reportPaper && (
                        <span className={styles.backCrumbs}>
                            {reportGap && (
                                <>
                                    <span>Gap {reportGap}</span>
                                    <span aria-hidden="true">›</span>
                                </>
                            )}
                            <span className={styles.backCrumbCurrent}>
                                Paper {reportPaper}
                            </span>
                        </span>
                    )}
                </div>
                {(canUseChatTools || shareOptions.length > 0) && (
                    <div className={styles.paperTools} role="toolbar" aria-label="Paper tools">
                        {canUseChatTools && (
                            <button
                                type="button"
                                className={`${styles.toolButton} ${
                                    activeTool === "highlight" ? styles.toolButtonActive : ""
                                }`}
                                onClick={() => toggleTool("highlight")}
                                aria-pressed={activeTool === "highlight"}
                            >
                                <PencilIcon />
                                <span className={styles.toolLabel}>
                                    {activeTool === "highlight" ? "Highlighting…" : "Highlight"}
                                </span>
                            </button>
                        )}
                        {shareOptions.length === 1 && (
                            <button
                                type="button"
                                className={styles.toolButtonPrimary}
                                onClick={shareOptions[0].run}
                            >
                                <ShareIcon />
                                Share
                            </button>
                        )}
                        {shareOptions.length > 1 && (
                            <div ref={shareMenuRef} className={styles.shareMenuWrap}>
                                <button
                                    type="button"
                                    className={styles.toolButtonPrimary}
                                    aria-expanded={shareMenuOpen}
                                    aria-controls="paper-share-menu"
                                    onClick={() => setShareMenuOpen((open) => !open)}
                                >
                                    <ShareIcon />
                                    Share
                                    <span
                                        className={shareMenuOpen ? styles.shareChevronOpen : styles.shareChevron}
                                        aria-hidden="true"
                                    />
                                </button>
                                <div
                                    id="paper-share-menu"
                                    className={shareMenuOpen ? styles.shareMenuOpen : styles.shareMenu}
                                    inert={!shareMenuOpen}
                                >
                                    {shareOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            className={styles.shareOption}
                                            onClick={() => {
                                                setShareMenuOpen(false);
                                                option.run();
                                            }}
                                        >
                                            <strong>{option.label}</strong>
                                            <span>{option.detail}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {noticeDismissed && redirectNotice && (
                <div className={styles.noticeBanner}>
                    <p className={styles.noticeBannerText}>
                        You are viewing a {redirectNotice.noticeType} notice.
                    </p>
                    <button
                        className={styles.noticeBannerButton}
                        onClick={handleOpenFullArticle}
                    >
                        Open full research article
                    </button>
                </div>
            )}
            <div
                className={`${styles.paperchatcontainer} ${
                    researchPaper && !chatMode
                        ? styles.restrictedContainer
                        : ""
                }`}
            >
                {initialLoading ? (
                    <>
                        <div className={styles.paperSkeleton} aria-hidden="true">
                            <span className={`${styles.skelBar} ${styles.skelContents} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelTitle} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelTitleShort} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelMeta} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelCard} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelLine} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelLine} loading-skeleton`} />
                            <span className={`${styles.skelBar} ${styles.skelLineShort} loading-skeleton`} />
                        </div>
                        <div
                            className={`${styles.chatSkeleton} loading-skeleton`}
                            aria-hidden="true"
                        />
                    </>
                ) : (
                    <>
                        {loadError ? (
                            <div className={styles.loadError}>{loadError}</div>
                        ) : (
                            <div className={`${styles.paperColumn} ${styles.fadeIn}`}>
                                <Paperbox
                                    paper={researchPaper}
                                    browserBodyLoading={browserBodyLoading}
                                    searchTerm={qParam}
                                    isPro={canAnalyzeFigures}
                                    activeTool={activeTool}
                                    persistHighlights={persistHighlights}
                                    onAnalyzeFigure={handleAnalyzeFigure}
                                    onHighlight={handleHighlight}
                                    onMarksChange={setHighlights}
                                    onSummarize={
                                        authenticated && chatMode
                                            ? () => setPendingQuestion(SUMMARY_QUESTION)
                                            : undefined
                                    }
                                    onShowHighlights={() =>
                                        setShowHighlightsRequest((count) => count + 1)
                                    }
                                    focusExcerpt={focusExcerpt}
                                    locateMethod={locateMethod}
                                    focusCitation={focusCitation}
                                    focusRequestId={focusRequestId}
                                />
                            </div>
                        )}
                        {authenticated && (chatMode || canAnalyzeFigures) ? (
                            <div className={`${styles.chatColumn} ${styles.fadeInLate}`}>
                                <ResponsiveChatPanel
                                    wholePaper={researchPaper}
                                    allMessages={allMessages}
                                    setAllMessages={setAllMessages}
                                    figureRequest={figureRequest}
                                    onFigureRequestHandled={() =>
                                        setFigureRequest(null)
                                    }
                                    canAnalyzeFigures={canAnalyzeFigures}
                                    pendingAttachment={pendingAttachment}
                                    onPendingAttachmentChange={
                                        setPendingAttachment
                                    }
                                    pendingInsert={pendingInsert}
                                    onPendingInsertHandled={() =>
                                        setPendingInsert(null)
                                    }
                                    onLocateCitation={handleLocateCitation}
                                    highlights={highlights}
                                    showHighlightsRequest={showHighlightsRequest}
                                    pendingQuestion={pendingQuestion}
                                    onPendingQuestionHandled={() =>
                                        setPendingQuestion(null)
                                    }
                                    activeTool={activeTool}
                                />
                            </div>
                        ) : chatMode ? (
                            <div className={styles.restrictedChat}>
                                <ResearchBot className={styles.restrictedBot} />
                                <p className={styles.restrictedEyebrow}>
                                    Paper assistant
                                </p>
                                <h2>Ask this paper with a free account</h2>
                                <p>
                                    Reading is public. Sign in to save the paper
                                    and ask questions about licensed excerpts.
                                </p>
                                <div className={styles.restrictedActions}>
                                    <Link
                                        className={styles.restrictedPrimary}
                                        href="/signup"
                                    >
                                        Create free account
                                    </Link>
                                    <Link
                                        className={styles.restrictedSecondary}
                                        href="/login"
                                    >
                                        Sign in
                                    </Link>
                                </div>
                            </div>
                        ) : researchPaper ? (
                            <div className={styles.restrictedChat}>
                                <ResearchBot className={styles.restrictedBot} />
                                <p className={styles.restrictedEyebrow}>
                                    Paper assistant
                                </p>
                                <h2>Chat is unavailable for this article</h2>
                                <p>{researchPaper.access.policyReason}</p>
                                <p>
                                    This protects the article&apos;s reuse
                                    rights. You can still use the citation and
                                    publisher link.
                                </p>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};

export default PaperChatClient;
