"use client";
import clsx from "clsx";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Chatbox from "../components/paperchatbot/Chatbox";
import Paperbox from "../components/paperchatbot/Paperbox";
import type { FormattedPaper } from "../api/general-interfaces";
import { buildChatMessages, type ChatMessage } from "../lib/chat-messages";
import { locateExcerptInPaper, type PaperCitation } from "../lib/paper-citation";
import { withReportOrigin, type ReportReturn } from "../lib/paper-sources";
import { findAnchoredSentence, paperSearchText } from "../lib/paper-evidence";
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
    requestId: number;
    origin: { x: number; y: number } | null;
};

/** Matches the .popup transition; hidden is applied after the close animation. */
const CLOSE_MS = 280;

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

function PaperConversation({
    paper,
    context,
    pendingQuestion,
    onPendingQuestionHandled,
    focusExcerpt,
    focusKey,
    citedFor,
    focusAnchor,
    returnTo,
}: {
    paper: Paper;
    context: string;
    citedFor?: string | null;
    focusAnchor?: EvidenceAnchor | null;
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
    const [passageMissing, setPassageMissing] = useState(false);
    const anchorKey = focusAnchor ? `${focusAnchor.hash}.${focusAnchor.length}` : "";
    useEffect(() => {
        if (!loaded || !focusKey) return;
        const passage =
            focusExcerpt ||
            (focusAnchor ? findAnchoredSentence(paperSearchText(loaded), focusAnchor) : null);
        setPassageMissing(!passage);
        if (!passage) return;
        setFocusCitation(locateExcerptInPaper(loaded, passage));
        setFocusRequestId((current) => current + 1);
        // focusAnchor is read through anchorKey so a new object with the same
        // fingerprint doesn't repaint.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, focusExcerpt, anchorKey, focusKey]);
    const noPassage = Boolean(focusKey) && passageMissing;

    if (error) {
        return (
            <div role="alert">
                {error}{" "}
                <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                    Retry
                </button>
            </div>
        );
    }
    if (!loaded) {
        return <p role="status">Loading paper and your conversation…</p>;
    }
    return (
        <div className={styles.split}>
            <div className={styles.paperPane}>
                {citedFor && (focusExcerpt || focusAnchor) && !passageMissing ? (
                    <div className={styles.citedFor}>
                        <span className={styles.citedForLabel}>Cited for</span>
                        <p>{citedFor}</p>
                        <span className={styles.citedForNote}>
                            The pink sentence is the evidence the report used.
                        </span>
                    </div>
                ) : null}
                {noPassage && (
                    <p className={styles.noPassage} role="status">
                        There’s no exact passage to highlight for this citation.
                        Ask the chat where the paper supports the claim.
                    </p>
                )}
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
                    pendingQuestion={pendingQuestion}
                    onPendingQuestionHandled={onPendingQuestionHandled}
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
                            key={`${paper.index}-${paper.database}-${paper.paperId}`}
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
                            />
                        </div>
                    ))}
            </div>
        </section>
    );
}
