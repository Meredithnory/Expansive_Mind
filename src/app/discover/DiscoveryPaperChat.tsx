"use client";
import clsx from "clsx";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Chatbox from "../components/paperchatbot/Chatbox";
import Loading from "../components/Loading";
import Paperbox from "../components/paperchatbot/Paperbox";
import type { FormattedPaper } from "../api/general-interfaces";
import { buildChatMessages, type ChatMessage } from "../lib/chat-messages";
import { locateExcerptInPaper, type PaperCitation } from "../lib/paper-citation";
import { withReportOrigin, type ReportReturn } from "../lib/paper-sources";
import { sendProductSignal } from "../lib/product-signals";
import {
    closestSentence,
    findAnchoredSentence,
    paperSearchText,
} from "../lib/paper-evidence";
import type { EvidenceAnchor } from "../api/discover/report-types";
import styles from "./discovery-paper-chat.module.scss";

/** A citation click: the passage to highlight and the viewport point the panel grows from. */
export type PaperChatFocus = {
    paperIndex: number;
    excerpt: string;
    /** The finding the highlighted sentence is evidence for, when a chip named one. */
    citedFor?: string | null;
    /** For a paper we can't quote: the evidence sentence's fingerprint. */
    anchor?: EvidenceAnchor | null;
    /** The report's claim, matched against the paper when no sentence was recorded. */
    claim?: string | null;
    requestId: number;
    origin: { x: number; y: number } | null;
};

/** Matches the .popup transition; hidden is applied after the close animation. */
const CLOSE_MS = 280;

/** After this long, the loader says the full text is still on its way. */
const SLOW_LOAD_MS = 4_000;

/** Space kept between the panel and the nav above it. */
const EDGE_GAP = 12;

/** Start the panel under the top nav (desktop; the phone nav sits at the bottom). */
function fitUnderNav(node: HTMLElement) {
    const nav = document.querySelector<HTMLElement>("[data-app-nav]");
    const navRect = nav?.getBoundingClientRect();
    if (navRect && navRect.height > 0 && navRect.bottom < window.innerHeight / 2) {
        node.style.setProperty(
            "--paper-chat-top",
            `${Math.max(8, Math.round(navRect.bottom + EDGE_GAP))}px`,
        );
    } else {
        node.style.removeProperty("--paper-chat-top");
    }
}

type Paper = {
    index: number;
    title: string;
    database: string;
    paperId: string;
    idName: string;
    href: string;
};

const SKELETON_LINES = ["96%", "100%", "88%", "93%", "71%", "97%", "84%", "62%"];

/** The panel's own layout, drawn in shimmer, with the real title up front. */
function PaperLoading({ title }: { title: string }) {
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
        return () => window.clearTimeout(timer);
    }, []);
    const label = slow ? "Still fetching the full text…" : "Opening the paper…";
    return (
        <div className={styles.split} role="status" aria-live="polite" aria-label={label}>
            <div className={clsx(styles.paperPane, styles.loadingPane)} aria-hidden="true">
                <div className={styles.loadingBadge}>
                    <Loading />
                    <span>{label}</span>
                </div>
                <div className={styles.skeletonRow}>
                    <span className={clsx(styles.skeletonChip, "loading-skeleton")} />
                    <span className={clsx(styles.skeletonChip, "loading-skeleton")} />
                    <span className={clsx(styles.skeletonChip, "loading-skeleton")} />
                </div>
                <p className={styles.loadingTitle}>{title}</p>
                <span className={clsx(styles.skeletonLine, styles.skeletonShort, "loading-skeleton")} />
                <span className={clsx(styles.skeletonHeading, "loading-skeleton")} />
                {SKELETON_LINES.map((width, index) => (
                    <span
                        key={index}
                        className={clsx(styles.skeletonLine, "loading-skeleton")}
                        style={{ width }}
                    />
                ))}
            </div>
            <div className={clsx(styles.chatPane, styles.loadingChat)} aria-hidden="true">
                <div className={styles.skeletonRow}>
                    <span className={clsx(styles.skeletonAvatar, "loading-skeleton")} />
                    <span className={styles.skeletonStack}>
                        <span className={clsx(styles.skeletonLine, "loading-skeleton")} style={{ width: "46%" }} />
                        <span className={clsx(styles.skeletonLine, "loading-skeleton")} style={{ width: "64%" }} />
                    </span>
                </div>
                <span className={clsx(styles.skeletonLine, "loading-skeleton")} style={{ width: "92%" }} />
                <span className={clsx(styles.skeletonLine, "loading-skeleton")} style={{ width: "78%" }} />
                <span className={styles.skeletonSpacer} />
                {[0, 1, 2].map((index) => (
                    <span key={index} className={clsx(styles.skeletonPrompt, "loading-skeleton")} />
                ))}
                <span className={clsx(styles.skeletonInput, "loading-skeleton")} />
            </div>
        </div>
    );
}

function PaperConversation({
    paper,
    context,
    pendingQuestion,
    onPendingQuestionHandled,
    focusExcerpt,
    focusKey,
    citedFor,
    focusAnchor,
    focusClaim,
    returnTo,
}: {
    paper: Paper;
    context: string;
    citedFor?: string | null;
    focusAnchor?: EvidenceAnchor | null;
    focusClaim?: string | null;
    returnTo?: ReportReturn;
    pendingQuestion?: string | null;
    onPendingQuestionHandled?: () => void;
    /** The cited passage; each new focusKey scrolls to and highlights it again. */
    focusExcerpt?: string;
    focusKey?: number;
}) {
    const [loaded, setLoaded] = useState<FormattedPaper | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [focusCitation, setFocusCitation] = useState<PaperCitation | null>(null);
    const [focusRequestId, setFocusRequestId] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setError("");
        const params = new URLSearchParams({
            database: paper.database,
            paperId: paper.paperId,
            idName: paper.idName,
        });
        void fetch(`/api/paper?${params}`, { signal: controller.signal })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok || !data.paper) {
                    throw new Error(data.error || "Unable to load this paper.");
                }
                if (!controller.signal.aborted) {
                    setLoaded(data.paper);
                    setMessages(buildChatMessages(data.messages || []));
                }
            })
            .catch((loadError) => {
                if (!controller.signal.aborted) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Unable to load paper.",
                    );
                }
            });
        return () => controller.abort();
    }, [paper.database, paper.paperId, paper.idName, attempt]);

    // Same path as a chat citation: locate the excerpt, then Paperbox scrolls
    // to it and paints the highlight. A paper we can't quote has no stored
    // sentence, only its fingerprint; find the sentence in the loaded text.
    // With neither, highlight the paper's sentence closest to the claim and
    // say it is a match, not the report's evidence.
    const [passageKind, setPassageKind] = useState<"exact" | "closest" | "none">(
        "exact",
    );
    const anchorKey = focusAnchor ? `${focusAnchor.hash}.${focusAnchor.length}` : "";
    useEffect(() => {
        if (!loaded || !focusKey) return;
        const exact =
            focusExcerpt ||
            (focusAnchor ? findAnchoredSentence(paperSearchText(loaded), focusAnchor) : null);
        const passage = exact || (focusClaim ? closestSentence(loaded, focusClaim) : null);
        setPassageKind(exact ? "exact" : passage ? "closest" : "none");
        if (!exact) {
            sendProductSignal(passage ? "citation_closest_match" : "citation_no_match");
        }
        if (!passage) return;
        setFocusCitation(locateExcerptInPaper(loaded, passage));
        setFocusRequestId((current) => current + 1);
        // focusAnchor is read through anchorKey so a new object with the same
        // fingerprint doesn't repaint.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, focusExcerpt, anchorKey, focusClaim, focusKey]);
    const focused = Boolean(focusKey);
    // "Find it with the assistant": the chat quotes the passage, and its
    // citation highlights in the paper like any other.
    const [askedForPassage, setAskedForPassage] = useState<string | null>(null);

    if (error) {
        return (
            <div className={styles.loadError} role="alert">
                <p className={styles.loadErrorTitle}>This paper didn’t open.</p>
                <p>{error}</p>
                <div className={styles.loadErrorActions}>
                    <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                        Try again
                    </button>
                    <a
                        href={withReportOrigin(paper.href, paper.index, null, returnTo)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in the reader
                    </a>
                </div>
            </div>
        );
    }
    if (!loaded) {
        return <PaperLoading title={paper.title} />;
    }
    return (
        <div className={styles.split}>
            <div className={styles.paperPane}>
                {focused && passageKind === "exact" && citedFor ? (
                    <div className={styles.citedFor}>
                        <span className={styles.citedForLabel}>Cited for</span>
                        <p>{citedFor}</p>
                        <span className={styles.citedForNote}>
                            The pink sentence is the evidence the report used.
                        </span>
                    </div>
                ) : null}
                {focused && passageKind === "closest" && focusClaim ? (
                    <div className={clsx(styles.citedFor, styles.citedForMatch)} role="status">
                        <span className={styles.citedForLabel}>Closest match</span>
                        <p>{focusClaim}</p>
                        <span className={styles.citedForNote}>
                            The report didn’t record a sentence for this citation.
                            The pink sentence is the closest one we found in the
                            paper. Check that it says what the claim says.
                        </span>
                    </div>
                ) : null}
                {focused && passageKind === "none" ? (
                    <div className={styles.noPassage} role="status">
                        <p>No sentence in this paper clearly matches the claim.</p>
                        {focusClaim ? (
                            <button
                                type="button"
                                className={styles.findPassage}
                                onClick={() =>
                                    setAskedForPassage(
                                        `Which passage in this paper supports this claim: "${focusClaim}"? Quote it, or say that the paper doesn't support it.`,
                                    )
                                }
                            >
                                Ask the paper assistant to find it
                            </button>
                        ) : null}
                    </div>
                ) : null}
                <Paperbox
                    paper={loaded}
                    searchTerm={null}
                    isPro={false}
                    onAnalyzeFigure={() => undefined}
                    focusCitation={focusCitation}
                    focusRequestId={focusRequestId}
                />
            </div>
            <div className={styles.chatPane}>
                <a
                    className={styles.openFullPaper}
                    href={withReportOrigin(paper.href, paper.index, null, returnTo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open full paper and conversation in a new tab"
                >
                    <span className={styles.openFullPaperLabel}>Open full paper</span>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M5.5 3.25h7.25V10.5h-1.5V5.81L4.28 12.78l-1.06-1.06 6.97-6.97H5.5v-1.5Z"
                        />
                    </svg>
                </a>
                <Chatbox
                    wholePaper={loaded}
                    allMessages={messages}
                    setAllMessages={setMessages}
                    researchContext={context}
                    pendingQuestion={askedForPassage ?? pendingQuestion}
                    onPendingQuestionHandled={() => {
                        if (askedForPassage) setAskedForPassage(null);
                        else onPendingQuestionHandled?.();
                    }}
                    onLocateCitation={(citation) => {
                        setFocusCitation(citation);
                        setFocusRequestId((current) => current + 1);
                    }}
                />
            </div>
        </div>
    );
}

export default function DiscoveryPaperChat({
    papers,
    question,
    open,
    selected,
    onClose,
    pendingQuestion,
    onPendingQuestionHandled,
    focus = null,
    returnTo,
    onSelectPaper,
}: {
    papers: Paper[];
    question: string;
    open: boolean;
    selected?: number;
    onClose: () => void;
    pendingQuestion?: string | null;
    onPendingQuestionHandled?: () => void;
    focus?: PaperChatFocus | null;
    /** The report and tab, for the full paper's "Your report" link. */
    returnTo?: ReportReturn;
    /** Switch the panel to another paper in the report. */
    onSelectPaper?: (index: number) => void;
}) {
    const switcherId = useId();
    const [visited, setVisited] = useState<number[]>([]);
    const close = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLElement>(null);
    // mounted keeps the panel in the tree while it animates out; shown drives the transition.
    const [mounted, setMounted] = useState(open);
    const [shown, setShown] = useState(open);
    const animatedRequest = useRef(0);

    useEffect(() => {
        if (open) close.current?.focus();
    }, [open]);

    useEffect(() => {
        if (open) {
            setMounted(true);
            return;
        }
        setShown(false);
        const timer = window.setTimeout(() => setMounted(false), CLOSE_MS);
        return () => window.clearTimeout(timer);
    }, [open]);

    // Declared before the grow effect so the panel is measured at its final size.
    useLayoutEffect(() => {
        const node = panel.current;
        if (!mounted || !node) return;
        const fit = () => fitUnderNav(node);
        fit();
        const resize = new ResizeObserver(fit);
        const nav = document.querySelector("[data-app-nav]");
        if (nav) resize.observe(nav);
        window.addEventListener("resize", fit);
        return () => {
            resize.disconnect();
            window.removeEventListener("resize", fit);
        };
    }, [mounted]);

    // Grow from the clicked citation. Other opens (composer) grow from the bottom center.
    useLayoutEffect(() => {
        const node = panel.current;
        // Only at the moment of opening: re-measuring an open panel would
        // cancel its transition.
        if (!open || !mounted || shown || !node) return;
        const fromCitation =
            focus?.origin && focus.requestId !== animatedRequest.current;
        if (focus) animatedRequest.current = focus.requestId;
        // Measure the full-size box: the closed state is scaled down. Transitions
        // are paused so the measurement itself does not animate.
        node.style.transition = "none";
        node.style.transform = "translateX(-50%)";
        const rect = node.getBoundingClientRect();
        node.style.transform = "";
        void node.offsetWidth;
        node.style.transition = "";
        node.style.setProperty(
            "--paper-chat-origin",
            fromCitation && focus?.origin
                ? `${focus.origin.x - rect.left}px ${focus.origin.y - rect.top}px`
                : "50% 100%",
        );
        const frame = window.requestAnimationFrame(() => setShown(true));
        return () => window.cancelAnimationFrame(frame);
    }, [open, mounted, shown, focus]);

    useEffect(() => {
        if (!open || selected === undefined) return;
        setVisited((currentVisited) =>
            currentVisited.includes(selected)
                ? currentVisited
                : [...currentVisited, selected],
        );
    }, [open, selected]);

    return (
        <section
            ref={panel}
            hidden={!mounted}
            id="discovery-paper-chat"
            role="dialog"
            aria-modal="false"
            aria-labelledby="discovery-paper-chat-title"
            className={clsx(styles.popup, shown && styles.popupShown)}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    onClose();
                }
            }}
        >
            <header>
                <div className={styles.headerLead}>
                    <h2 id="discovery-paper-chat-title">Paper chat</h2>
                    {onSelectPaper && papers.length > 1 ? (
                        <label className={styles.paperSwitch} htmlFor={switcherId}>
                            <span className={styles.srOnly}>Paper to read and ask</span>
                            <select
                                id={switcherId}
                                value={selected ?? ""}
                                onChange={(event) => onSelectPaper(Number(event.target.value))}
                            >
                                {papers.map((paper) => (
                                    <option key={paper.index} value={paper.index}>
                                        Paper {paper.index}: {paper.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                </div>
                <button
                    ref={close}
                    type="button"
                    onClick={onClose}
                    aria-label="Close paper chat"
                >
                    ×
                </button>
            </header>
            <div className={styles.conversations}>
                {papers
                    .filter((paper) => visited.includes(paper.index))
                    .map((paper) => (
                        <div
                            key={`${paper.database}-${paper.paperId}`}
                            hidden={paper.index !== selected}
                            className={styles.conversation}
                        >
                            <PaperConversation
                                paper={paper}
                                returnTo={returnTo}
                                context={`Discovery question: ${question}`}
                                pendingQuestion={
                                    paper.index === selected ? pendingQuestion : null
                                }
                                onPendingQuestionHandled={onPendingQuestionHandled}
                                focusExcerpt={
                                    focus?.paperIndex === paper.index
                                        ? focus.excerpt
                                        : undefined
                                }
                                focusKey={
                                    focus?.paperIndex === paper.index
                                        ? focus.requestId
                                        : undefined
                                }
                                citedFor={
                                    focus?.paperIndex === paper.index
                                        ? focus.citedFor
                                        : null
                                }
                                focusAnchor={
                                    focus?.paperIndex === paper.index
                                        ? focus.anchor
                                        : null
                                }
                                focusClaim={
                                    focus?.paperIndex === paper.index
                                        ? focus.claim
                                        : null
                                }
                            />
                        </div>
                    ))}
            </div>
        </section>
    );
}
