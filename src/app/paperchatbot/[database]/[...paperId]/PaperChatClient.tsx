"use client";
import React, { useCallback, useEffect, useState } from "react";
import styles from "./paperchatbot.module.scss";
import Paperbox from "../../../components/paperchatbot/Paperbox";
import dynamic from "next/dynamic";
import Image from "next/image";
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
import type { PaperCitation } from "../../../lib/paper-citation";
import type { PaperTool } from "../../../lib/region-capture";

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

const REDIRECT_DELAY_SECONDS = 15;

const NOTICE_COPY: Record<RelatedResearchArticle["noticeType"], string> = {
    correction:
        "This page is a correction notice, not the full research article.",
    erratum: "This page is an erratum, not the full research article.",
    retraction: "This page is a retraction notice.",
    "expression-of-concern":
        "This page is an expression of concern notice.",
};

const LeftArrowSVG = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="m0 13.453 11.986 12.7 2.731-2.893-9.255-9.807 9.255-9.807-2.73-2.894L0 13.452Zm10.91 0 11.986 12.7 2.731-2.893-9.255-9.807 9.255-9.807-2.73-2.894-11.987 12.7Z" />
    </svg>
);

type PaperChatClientProps = {
    database: string;
    paperId: string;
    qParam: string | null;
    focusExcerpt: string | null;
    locateMethod: boolean;
    requestedIdName: string | null;
};

const PaperChatClient = ({
    database,
    paperId,
    qParam,
    focusExcerpt,
    locateMethod,
    requestedIdName,
}: PaperChatClientProps) => {
    const router = useRouter();
    const sourceConfig = getSourceByDatabase(database);
    const idName = requestedIdName || sourceConfig?.defaultIdName || "pmcid";

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
    const [briefOpen, setBriefOpen] = useState(false);

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

    const canUseChatTools =
        authenticated &&
        Boolean(
            researchPaper &&
                (researchPaper.access.canSendToAI || canAnalyzeFigures),
        );
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

    const handleHighlight = (citation: PaperCitation) => {
        setPendingInsert(citation);
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

    return (
        <div className={styles.page}>
            <LoadingOverlay visible={loading} label="Preparing this paper…" />
            {researchPaper && briefOpen && (
                <BriefModal
                    paper={researchPaper}
                    open={briefOpen}
                    onClose={() => setBriefOpen(false)}
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
            <div className={styles.toolsbox}>
                <div className={styles.searcharea}>
                    <button
                        className={styles.searchbutton}
                        onClick={() => router.back()}
                    >
                        <LeftArrowSVG />
                        <div className={styles.text}>Back to research</div>
                    </button>
                </div>
                {canUseChatTools && (
                    <div className={styles.paperTools} role="toolbar" aria-label="Paper tools">
                        <button
                            type="button"
                            className={`${styles.toolButton} ${
                                activeTool === "highlight" ? styles.toolButtonActive : ""
                            }`}
                            onClick={() => toggleTool("highlight")}
                            aria-pressed={activeTool === "highlight"}
                        >
                            <Image
                                src="/highlighticon.svg"
                                alt=""
                                width={16}
                                height={16}
                            />
                            Highlight
                        </button>
                        {researchPaper?.access.canSendToAI && (
                            <button
                                type="button"
                                className={styles.toolButton}
                                onClick={() => setBriefOpen(true)}
                            >
                                Share summary
                            </button>
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
                    researchPaper &&
                    !researchPaper.access.canSendToAI
                        ? styles.restrictedContainer
                        : ""
                }`}
            >
                {initialLoading ? (
                    <>
                        <div
                            className={`${styles.paperSkeleton} loading-skeleton`}
                            aria-hidden="true"
                        />
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
                            <div className={styles.paperColumn}>
                                <Paperbox
                                    paper={researchPaper}
                                    searchTerm={qParam}
                                    isPro={canAnalyzeFigures}
                                    activeTool={activeTool}
                                    persistHighlights={persistHighlights}
                                    onAnalyzeFigure={handleAnalyzeFigure}
                                    onHighlight={handleHighlight}
                                    focusExcerpt={focusExcerpt}
                                    locateMethod={locateMethod}
                                    focusCitation={focusCitation}
                                    focusRequestId={focusRequestId}
                                />
                            </div>
                        )}
                        {authenticated &&
                        (researchPaper?.access.canSendToAI ||
                            canAnalyzeFigures) ? (
                            <div className={styles.chatColumn}>
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
                                    activeTool={activeTool}
                                />
                            </div>
                        ) : researchPaper?.access.canSendToAI ? (
                            <div className={styles.restrictedChat}>
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
