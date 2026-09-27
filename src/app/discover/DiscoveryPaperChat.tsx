"use client";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Chatbox from "../components/paperchatbot/Chatbox";
import Paperbox from "../components/paperchatbot/Paperbox";
import type { FormattedPaper } from "../api/general-interfaces";
import { buildChatMessages, type ChatMessage } from "../lib/chat-messages";
import { locateExcerptInPaper, type PaperCitation } from "../lib/paper-citation";
import styles from "./discovery-paper-chat.module.scss";

/** A citation click: the passage to highlight and the viewport point the panel grows from. */
export type PaperChatFocus = {
    paperIndex: number;
    excerpt: string;
    requestId: number;
    origin: { x: number; y: number } | null;
};

/** Matches the .popup transition; hidden is applied after the close animation. */
const CLOSE_MS = 280;

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
}: {
    paper: Paper;
    context: string;
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
    // to it and paints the highlight.
    useEffect(() => {
        if (!loaded || !focusExcerpt || !focusKey) return;
        setFocusCitation(locateExcerptInPaper(loaded, focusExcerpt));
        setFocusRequestId((current) => current + 1);
    }, [loaded, focusExcerpt, focusKey]);
    // Papers without a licensed excerpt (abstract-only, or a license that does
    // not allow quoting) have nothing exact to highlight. Say so.
    const noPassage = Boolean(focusKey) && !focusExcerpt;

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
                {noPassage && (
                    <p className={styles.noPassage} role="status">
                        This paper has no licensed passage to highlight. Ask the
                        chat where it supports the claim.
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
                    href={paper.href}
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
                    hideComposer
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
}: {
    papers: Paper[];
    question: string;
    open: boolean;
    selected?: number;
    onClose: () => void;
    pendingQuestion?: string | null;
    onPendingQuestionHandled?: () => void;
    focus?: PaperChatFocus | null;
}) {
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
                <h2 id="discovery-paper-chat-title">Paper chat</h2>
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
                            />
                        </div>
                    ))}
            </div>
        </section>
    );
}
