"use client";
import React, {
    useState,
    useRef,
    useEffect,
    SetStateAction,
    useCallback,
    useId,
    useMemo,
} from "react";
import styles from "../styles/chatbox.module.scss";
import clsx from "clsx";
import { FormattedPaper } from "../../api/general-interfaces";
import SafeAssistantMarkdown from "../SafeAssistantMarkdown";
import ThinkingIndicator from "./ThinkingIndicator";
import type {
    ChatMessage,
    FigureAnalysisRequest,
    PendingChatAttachment,
} from "../../lib/chat-messages";
import {
    WELCOME_COPY,
    paperChatPrompts,
    splitFollowUps,
} from "../../lib/chat-messages";
import {
    MAX_HIGHLIGHTS_PER_PAPER,
    type PaperHighlightRecord,
} from "../../lib/paper-highlights";
import { FIGURE_RIGHTS_ATTESTATION_VERSION } from "../../lib/figure-capture";
import { askForRating } from "../../lib/rating";
import { showLimitReached } from "../../lib/limit-reached";
import { REPLAY_MASK } from "../../lib/replay-privacy";
import { notOnPlanMessage } from "../../lib/plan-messages";
import { MAX_CAPTURE_BYTES } from "../../lib/canvas-image";
import { formatExcerptQuestion } from "../../lib/region-capture";
import {
    citationLabel,
    encodeCitedMessage,
    parseCitedMessage,
    withPaperLineNumbers,
    type PaperCitation,
} from "../../lib/paper-citation";
import { useSession } from "../../lib/use-session";
import { paperChatMode } from "../../lib/chat-access";

const SendIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
            d="M5 12h12M13 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const SparkleIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path
            d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <path
            d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"
            fill="currentColor"
        />
    </svg>
);

const HIGHLIGHT_DOT_CLASS: Record<PaperHighlightRecord["color"], string> = {
    pink: styles.highlightDot_pink,
    blue: styles.highlightDot_blue,
    yellow: styles.highlightDot_yellow,
};

const citationKey = (citation: PaperCitation) =>
    `${citation.sectionTitle}|${citation.startLine}|${citation.endLine}`;

const Message = React.memo(function Message({ message }: { message: string }) {
    return (
        <div className={styles.prose}>
            <SafeAssistantMarkdown>{message}</SafeAssistantMarkdown>
        </div>
    );
});

const CitationCard = ({
    citation,
    compact = false,
    active = false,
    onRemove,
    onLocate,
}: {
    citation: PaperCitation;
    compact?: boolean;
    /** This passage is the one currently marked in the paper. */
    active?: boolean;
    onRemove?: () => void;
    onLocate?: (citation: PaperCitation) => void;
}) => {
    const locate = onLocate ? () => onLocate(citation) : undefined;
    const quote = citation.lines.join(" ").replace(/\s+/g, " ").trim();
    return (
        <div
            className={clsx(
                styles.citation,
                compact && styles.citationCompact,
                locate && styles.citationButton,
                active && styles.citationActive,
            )}
            onClick={locate}
        >
            <div className={styles.citationHeader}>
                <span className={styles.citationFlag} aria-hidden="true">
                    ¶
                </span>
                <span className={styles.citationTitle}>
                    {citation.sectionTitle}
                </span>
                <span className={styles.citationRange}>
                    {citation.startLine === citation.endLine
                        ? `· line ${citation.startLine}`
                        : `· lines ${citation.startLine}–${citation.endLine}`}
                </span>
                {onLocate && (
                    <button
                        type="button"
                        className={styles.citationLocate}
                        onClick={(event) => {
                            event.stopPropagation();
                            onLocate(citation);
                        }}
                        aria-label={`Show ${citationLabel(citation)} in the paper`}
                        aria-pressed={active}
                    >
                        {active ? "Showing in paper" : "Show in paper"}
                    </button>
                )}
                {onRemove && (
                    <button
                        type="button"
                        className={styles.citationRemove}
                        onClick={(event) => {
                            event.stopPropagation();
                            onRemove();
                        }}
                        aria-label={`Remove ${citationLabel(citation)}`}
                    >
                        ×
                    </button>
                )}
            </div>
            {!compact && quote && (
                <p className={styles.citationQuote}>“{quote}”</p>
            )}
        </div>
    );
};

const UserTurn = ({
    message,
    activeKey,
    onLocate,
}: {
    message: ChatMessage;
    activeKey?: string | null;
    onLocate?: (citation: PaperCitation) => void;
}) => {
    const parsed = parseCitedMessage(message.message);
    if (parsed.citations.length === 0) {
        return <div>{message.message}</div>;
    }
    return (
        <div className={styles.userTurn}>
            {parsed.citations.map((citation, index) => (
                <CitationCard
                    key={`${citation.sectionTitle}-${citation.startLine}-${index}`}
                    citation={citation}
                    active={activeKey === citationKey(citation)}
                    onLocate={onLocate}
                />
            ))}
            {parsed.question && (
                <div className={styles.userPrompt}>{parsed.question}</div>
            )}
        </div>
    );
};

const Messages = ({
    messages,
    loading,
    onLocate,
    paper,
    activeKey,
    onAsk,
    fallbackFollowUps = [],
    hidden = false,
    panelProps,
}: {
    messages: ChatMessage[];
    loading: boolean;
    onLocate?: (citation: PaperCitation) => void;
    paper?: FormattedPaper | null;
    activeKey?: string | null;
    onAsk?: (question: string) => void;
    /** Asked-next questions when the latest answer suggested none. */
    fallbackFollowUps?: string[];
    hidden?: boolean;
    panelProps?: React.HTMLAttributes<HTMLDivElement>;
}) => {
    const messagesRef = useRef<HTMLDivElement>(null);
    const scrollFrameRef = useRef<number | null>(null);
    const lastAnswerRef = useRef<HTMLElement>(null);
    const wasLoading = useRef(loading);

    const scrollToBottom = useCallback(() => {
        if (scrollFrameRef.current !== null) return;
        scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            const element = messagesRef.current;
            if (element) element.scrollTop = element.scrollHeight;
        });
    }, []);

    // A new answer appears whole, so scroll to where it starts rather than
    // to its last line.
    const scrollToAnswerStart = useCallback(() => {
        const element = messagesRef.current;
        const answer = lastAnswerRef.current;
        if (!element || !answer) {
            scrollToBottom();
            return;
        }
        element.scrollTop +=
            answer.getBoundingClientRect().top -
            element.getBoundingClientRect().top -
            16;
    }, [scrollToBottom]);

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id;

    useEffect(() => {
        const answerArrived = wasLoading.current && !loading;
        wasLoading.current = loading;
        const timer = window.setTimeout(
            answerArrived ? scrollToAnswerStart : scrollToBottom,
            120,
        );
        return () => window.clearTimeout(timer);
    }, [loading, messages, scrollToAnswerStart, scrollToBottom]);

    useEffect(
        () => () => {
            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
            }
        },
        [],
    );

    const parsedAssistant = useMemo(() => {
        const byId = new Map<
            ChatMessage["id"],
            ReturnType<typeof parseCitedMessage> & { followUps: string[] }
        >();
        for (const msg of messages) {
            if (msg.sender !== "ai") continue;
            const { text, followUps } = splitFollowUps(msg.message);
            const parsed = parseCitedMessage(text);
            byId.set(msg.id, {
                ...parsed,
                followUps,
                citations: paper
                    ? parsed.citations.map((citation) =>
                          withPaperLineNumbers(paper, citation),
                      )
                    : parsed.citations,
            });
        }
        return byId;
    }, [messages, paper]);

    // "Ask next" follows the latest answer.
    const lastAnswer =
        lastMessage?.sender === "ai"
            ? parsedAssistant.get(lastMessage.id)
            : undefined;
    const answerFailed = String(lastId ?? "").startsWith("local-");
    const nextQuestions =
        lastAnswer && lastAnswer.followUps.length > 0
            ? lastAnswer.followUps
            : lastAnswer && !answerFailed
              ? fallbackFollowUps
              : [];
    const showNext =
        Boolean(onAsk) && !loading && nextQuestions.length > 0;

    return (
        <div
            className={clsx(styles.messages, REPLAY_MASK)}
            ref={messagesRef}
            hidden={hidden}
            {...panelProps}
        >
            {messages.map((msg: ChatMessage, index) => {
                if (msg.sender === "ai") {
                    const parsed = parsedAssistant.get(msg.id) || {
                        ...parseCitedMessage(msg.message),
                        followUps: [],
                    };
                    return (
                        <article
                            key={msg.id}
                            ref={
                                index === messages.length - 1
                                    ? lastAnswerRef
                                    : undefined
                            }
                            className={clsx(styles.turn, styles.turnAssistant)}
                        >
                            <div className={clsx(styles.message, styles.aiMessage)}>
                                {parsed.citations.length > 0 ? (
                                    <div className={styles.citationStack}>
                                        {parsed.citations.map(
                                            (citation, citeIndex) => (
                                                <CitationCard
                                                    key={`${citation.sectionTitle}-${citation.startLine}-${citeIndex}`}
                                                    citation={citation}
                                                    active={
                                                        activeKey ===
                                                        citationKey(citation)
                                                    }
                                                    onLocate={onLocate}
                                                />
                                            ),
                                        )}
                                    </div>
                                ) : null}
                                {parsed.question ? (
                                    <Message message={parsed.question} />
                                ) : null}
                            </div>
                        </article>
                    );
                }
                const parsed = parseCitedMessage(msg.message);
                if (parsed.citations.length > 0) {
                    return (
                        <article
                            key={msg.id}
                            className={clsx(styles.turn, styles.turnUser)}
                        >
                            <div className={styles.userTurnWrap}>
                                {msg.imagePreview && (
                                    <img
                                        className={styles.messageScreenshot}
                                        src={msg.imagePreview}
                                        alt="Attached screenshot"
                                    />
                                )}
                                <UserTurn
                                    message={msg}
                                    activeKey={activeKey}
                                    onLocate={onLocate}
                                />
                            </div>
                        </article>
                    );
                }
                return (
                    <article
                        key={msg.id}
                        className={clsx(styles.turn, styles.turnUser)}
                    >
                        <div className={clsx(styles.message, styles.userMessage)}>
                            {msg.imagePreview && (
                                <img
                                    className={styles.messageScreenshot}
                                    src={msg.imagePreview}
                                    alt="Attached screenshot"
                                />
                            )}
                            {msg.message ? <div>{msg.message}</div> : null}
                        </div>
                    </article>
                );
            })}
            {showNext && onAsk && (
                <div className={styles.nextQuestions}>
                    <p className={styles.nextLabel}>Ask next</p>
                    {nextQuestions.map((question) => (
                        <button
                            key={question}
                            type="button"
                            className={styles.nextChip}
                            onClick={() => onAsk(question)}
                        >
                            {question}
                        </button>
                    ))}
                </div>
            )}
            {loading && <ThinkingIndicator />}
        </div>
    );
};

const ALLOWED_ATTACHMENT_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
]);

interface InputProps {
    input: string;
    setInput: React.Dispatch<SetStateAction<string>>;
    handleSubmit: () => void;
    submitDisabled?: boolean;
    attachment?: PendingChatAttachment | null;
    citations?: PaperCitation[];
    onRemoveCitation?: (index: number) => void;
    attachmentPreview?: string;
    onRemoveAttachment?: () => void;
    onPasteImage?: (file: File) => void;
    composerError?: string;
    canAttachImages?: boolean;
}
const Input = ({
    input,
    setInput,
    handleSubmit,
    submitDisabled = false,
    attachment,
    citations = [],
    onRemoveCitation,
    attachmentPreview,
    onRemoveAttachment,
    onPasteImage,
    composerError,
    canAttachImages = false,
}: InputProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const resizeTextarea = useCallback((element: HTMLTextAreaElement) => {
        element.style.height = "0px";
        element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    }, []);

    useEffect(() => {
        if (textareaRef.current) resizeTextarea(textareaRef.current);
    }, [input, resizeTextarea]);

    const handleInput = (evt: React.FormEvent<HTMLTextAreaElement>) => {
        resizeTextarea(evt.currentTarget);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };
    const hint =
        "Answers can be wrong. Check the cited passages. Not medical advice.";

    return (
        <div className={styles.composer}>
            {composerError && (
                <p className={styles.composerError} role="alert">
                    {composerError}
                </p>
            )}
            <div
                className={styles.chatinput}
                onPaste={(event) => {
                    const file = Array.from(event.clipboardData.files).find(
                        (item) => ALLOWED_ATTACHMENT_TYPES.has(item.type),
                    );
                    if (!file || !onPasteImage) return;
                    event.preventDefault();
                    onPasteImage(file);
                }}
            >
                <div className={styles.composerMain}>
                    {attachmentPreview && (
                        <div className={styles.screenshotRow}>
                            <div className={styles.screenshotChip}>
                                <img
                                    src={attachmentPreview}
                                    alt="Captured screenshot"
                                />
                                <button
                                    type="button"
                                    className={styles.screenshotRemove}
                                    onClick={onRemoveAttachment}
                                    aria-label="Remove screenshot"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                    {citations.length > 0 && (
                        <div className={styles.citationStack}>
                            {citations.map((citation, index) => (
                                <CitationCard
                                    key={`${citation.sectionTitle}-${citation.startLine}-${index}`}
                                    citation={citation}
                                    compact
                                    onRemove={() => onRemoveCitation?.(index)}
                                />
                            ))}
                        </div>
                    )}
                    {attachment?.image && !canAttachImages && (
                        <p className={styles.screenshotHint}>
                            {notOnPlanMessage("Screenshot analysis")}
                        </p>
                    )}
                    <textarea
                        ref={textareaRef}
                        onInput={handleInput}
                        id="messageInput"
                        placeholder={
                            attachment?.image
                                ? "Ask a question about this screenshot…"
                                : citations.length > 0
                                  ? "Ask a question about this excerpt…"
                                  : "Ask about this paper…"
                        }
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    ></textarea>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={submitDisabled}
                    className={styles.submitButton}
                    aria-label="Send message"
                >
                    <SendIcon />
                </button>
            </div>
            <p className={styles.composerHint}>{hint}</p>
        </div>
    );
};
interface ChatboxProps {
    researchContext?: string;
    wholePaper: FormattedPaper | null;
    allMessages: ChatMessage[];
    setAllMessages: React.Dispatch<SetStateAction<ChatMessage[]>>;
    onSubmitStart?: () => void;
    figureRequest?: FigureAnalysisRequest | null;
    onFigureRequestHandled?: () => void;
    canAnalyzeFigures?: boolean;
    pendingAttachment?: PendingChatAttachment | null;
    onPendingAttachmentChange?: (
        attachment: PendingChatAttachment | null,
    ) => void;
    pendingInsert?: PaperCitation | null;
    onPendingInsertHandled?: () => void;
    pendingQuestion?: string | null;
    onPendingQuestionHandled?: () => void;
    hideComposer?: boolean;
    onLocateCitation?: (citation: PaperCitation) => void;
    /** The reader's highlights; when given, the panel gets a Highlights tab. */
    highlights?: PaperHighlightRecord[];
    /** Highlights are saved to the reader's account for this paper. */
    highlightsSaved?: boolean;
    /** Bump to open the Highlights tab (from the paper's Contents rail). */
    showHighlightsRequest?: number;
    /** Shows a close button in the header (the phone sheet). */
    onClose?: () => void;
}

type AssistantTab = "chat" | "highlights";

const Chatbox = ({
    researchContext,
    wholePaper,
    allMessages,
    setAllMessages,
    onSubmitStart,
    figureRequest,
    onFigureRequestHandled,
    canAnalyzeFigures = false,
    pendingAttachment = null,
    onPendingAttachmentChange,
    pendingInsert = null,
    onPendingInsertHandled,
    pendingQuestion = null,
    onPendingQuestionHandled,
    hideComposer = false,
    onLocateCitation,
    highlights,
    highlightsSaved = false,
    showHighlightsRequest = 0,
    onClose,
}: ChatboxProps) => {
    const { refresh } = useSession();
    const [inputMessage, setInputMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [composerError, setComposerError] = useState("");
    const [attachmentPreview, setAttachmentPreview] = useState("");
    const [citations, setCitations] = useState<PaperCitation[]>([]);
    const [tab, setTab] = useState<AssistantTab>("chat");
    const [locatedKey, setLocatedKey] = useState<string | null>(null);
    const tabsId = useId();
    const handledFigureRequest = useRef<string | null>(null);
    const handledPendingQuestion = useRef<string | null>(null);
    const sentScreenshotUrls = useRef<string[]>([]);
    const prompts = useMemo(
        () => paperChatPrompts(wholePaper),
        [wholePaper],
    );
    const isFreshChat = allMessages.length === 0 && !loading;
    // "abstract": the license keeps this paper's text out of the assistant.
    const chatMode = wholePaper ? paperChatMode(wholePaper) : null;

    useEffect(() => {
        setComposerError("");
    }, [pendingAttachment]);

    useEffect(() => {
        const urls = sentScreenshotUrls;
        return () => {
            urls.current.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    useEffect(() => {
        if (showHighlightsRequest > 0) setTab("highlights");
    }, [showHighlightsRequest]);

    const attachCitation = useCallback(
        (insert: PaperCitation) => {
            setTab("chat");
            if (chatMode !== "full") {
                setComposerError(
                    "This paper's license keeps its text out of the assistant, so passages can't be attached. Ask your question and it will answer from the abstract.",
                );
                return;
            }
            setCitations((current) =>
                current.some(
                    (citation) => citationKey(citation) === citationKey(insert),
                )
                    ? current
                    : [...current, insert],
            );
            window.requestAnimationFrame(() => {
                document.getElementById("messageInput")?.focus();
            });
        },
        [chatMode],
    );

    useEffect(() => {
        if (!pendingInsert) return;
        attachCitation(pendingInsert);
        onPendingInsertHandled?.();
    }, [attachCitation, onPendingInsertHandled, pendingInsert]);

    const locateCitation = useMemo(
        () =>
            onLocateCitation
                ? (citation: PaperCitation) => {
                      setLocatedKey(citationKey(citation));
                      onLocateCitation(citation);
                  }
                : undefined,
        [onLocateCitation],
    );

    useEffect(() => {
        if (!pendingAttachment?.image) {
            setAttachmentPreview("");
            return;
        }
        const url = URL.createObjectURL(pendingAttachment.image);
        setAttachmentPreview(url);
        window.requestAnimationFrame(() => {
            document.getElementById("messageInput")?.focus();
        });
        return () => URL.revokeObjectURL(url);
    }, [pendingAttachment?.image]);

    const sendTextMessage = async (
        messageText: string,
        displayMessage?: string,
    ) => {
        if (
            !messageText.trim() ||
            !wholePaper ||
            !chatMode ||
            !wholePaper.source
        ) {
            return;
        }

        onSubmitStart?.();
        setTab("chat");
        const senderMessage = {
            id: `local-user-${Date.now()}`,
            sender: "user",
            message: displayMessage || messageText,
            timestamp: new Date(),
        };

        setAllMessages((prevMessages) => [...prevMessages, senderMessage]);
        setInputMessage("");
        setLoading(true);

        try {
            const res = await fetch("/api/aichat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userResponse: messageText,
                    researchContext,
                    displayMessage: displayMessage || messageText,
                    database: wholePaper.source,
                    paperId: wholePaper.paperId,
                    idName: wholePaper.idName,
                }),
            });
            const data = await res.json();
            void refresh();

            if (!res.ok || !data.aiResponse) {
                if (data.code === "QUOTA_EXCEEDED" && data.quota) {
                    showLimitReached("chat", data.quota.limit);
                }
                // A used-up allowance says so; anything else stays generic.
                throw new Error(
                    data.code === "QUOTA_EXCEEDED" && typeof data.error === "string"
                        ? data.error
                        : "",
                );
            }

            setAllMessages((prevMessages) => [
                ...prevMessages,
                data.aiResponse,
            ]);
            askForRating("paper_chat", wholePaper.title || wholePaper.paperId);
        } catch (error) {
            console.error("Chat request failed");
            const limitMessage = error instanceof Error ? error.message : "";
            setAllMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: `local-error-${Date.now()}`,
                    sender: "ai",
                    message:
                        limitMessage ||
                        "I couldn't save that message. Please try again in a moment.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const submitFigureAnalysis = useCallback(
        async (request: FigureAnalysisRequest) => {
            if (!wholePaper || loading) return;
            onSubmitStart?.();
            setTab("chat");
            const figureLabel = request.figure?.label || "uploaded figure";
            const question =
                request.question?.trim() ||
                "Please explain this figure in plain language.";
            const userText =
                request.question?.trim() ||
                `Explain ${figureLabel} in plain language.`;
            const imagePreview = request.image
                ? URL.createObjectURL(request.image)
                : request.figure?.imageUrl;
            if (request.image && imagePreview) {
                sentScreenshotUrls.current.push(imagePreview);
            }
            setAllMessages((messages) => [
                ...messages,
                {
                    id: `local-figure-${request.requestId}`,
                    sender: "user",
                    message: userText,
                    timestamp: new Date(),
                    imagePreview,
                },
            ]);
            setLoading(true);
            try {
                const form = new FormData();
                form.set("database", wholePaper.source || "");
                form.set("paperId", wholePaper.paperId);
                form.set("idName", wholePaper.idName);
                form.set("question", question);
                if (request.figure) {
                    form.set("figureId", request.figure.id);
                }
                if (request.caption) form.set("caption", request.caption);
                if (request.image) {
                    form.set("image", request.image);
                    form.set("captureMethod", request.captureMethod || "");
                    form.set(
                        "rightsAttestation",
                        request.rightsAttestation || "",
                    );
                }

                const response = await fetch("/api/aichat/figure", {
                    method: "POST",
                    body: form,
                });
                const data = await response.json();
                void refresh();
                if (!response.ok || !data.aiResponse) {
                    throw new Error(
                        data.error || "The figure could not be analyzed.",
                    );
                }
                setAllMessages((messages) => [
                    ...messages,
                    data.aiResponse,
                ]);
            } catch (error) {
                setAllMessages((messages) => [
                    ...messages,
                    {
                        id: `local-figure-error-${request.requestId}`,
                        sender: "ai",
                        message:
                            error instanceof Error
                                ? error.message
                                : "The figure could not be analyzed.",
                        timestamp: new Date(),
                    },
                ]);
            } finally {
                setLoading(false);
                onFigureRequestHandled?.();
            }
        },
        [
            loading,
            onFigureRequestHandled,
            onSubmitStart,
            refresh,
            setAllMessages,
            wholePaper,
        ],
    );

    const handlePasteImage = (file: File) => {
        if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
            setComposerError("Choose a PNG, JPEG, or WebP image.");
            return;
        }
        if (file.size > MAX_CAPTURE_BYTES) {
            setComposerError("Images must be no larger than 5 MB.");
            return;
        }
        if (!canAnalyzeFigures) {
            setComposerError(notOnPlanMessage("Screenshot analysis"));
            return;
        }
        setComposerError("");
        onPendingAttachmentChange?.({
            image: file,
            captureMethod: "paste",
            excerpt: pendingAttachment?.excerpt,
        });
    };

    const handleSubmit = async () => {
        if (loading || !wholePaper) return;

        if (pendingAttachment?.image) {
            if (!canAnalyzeFigures || chatMode !== "full") return;
            const question =
                inputMessage.trim() ||
                "Please explain this screenshot.";
            const attachment = pendingAttachment;
            setInputMessage("");
            onPendingAttachmentChange?.(null);
            await submitFigureAnalysis({
                requestId: crypto.randomUUID(),
                image: attachment.image,
                caption: attachment.excerpt,
                captureMethod: attachment.captureMethod || "paste",
                rightsAttestation: FIGURE_RIGHTS_ATTESTATION_VERSION,
                question,
            });
            return;
        }

        if (citations.length > 0 && chatMode === "full") {
            const question =
                inputMessage.trim() || "What does this excerpt mean?";
            const excerpt = citations
                .map((citation) => citation.lines.join(" "))
                .join("\n\n");
            const displayMessage = encodeCitedMessage(citations, question);
            setCitations([]);
            setInputMessage("");
            await sendTextMessage(
                formatExcerptQuestion(question, excerpt).slice(0, 2_000),
                displayMessage,
            );
            return;
        }

        await sendTextMessage(inputMessage.trim());
    };

    useEffect(() => {
        // Cleared once handled, so the same question can be asked again.
        if (!pendingQuestion) handledPendingQuestion.current = null;
        const nextQuestion = pendingQuestion?.trim();
        if (!nextQuestion || loading || !wholePaper) return;
        if (handledPendingQuestion.current === pendingQuestion) return;
        handledPendingQuestion.current = pendingQuestion;
        onPendingQuestionHandled?.();
        if (!chatMode) return;
        void sendTextMessage(nextQuestion);
    }, [chatMode, loading, onPendingQuestionHandled, pendingQuestion, wholePaper]);

    useEffect(() => {
        if (
            !figureRequest ||
            loading ||
            handledFigureRequest.current === figureRequest.requestId
        ) {
            return;
        }
        handledFigureRequest.current = figureRequest.requestId;
        void submitFigureAnalysis(figureRequest);
    }, [figureRequest, loading, submitFigureAnalysis]);

    const canSendAttachmentImage = Boolean(
        pendingAttachment?.image && canAnalyzeFigures && chatMode === "full",
    );
    const canSendCitation = Boolean(
        citations.length > 0 && chatMode === "full",
    );
    const canSendText = Boolean(inputMessage.trim() && chatMode);
    const paperTitle = wholePaper?.title?.trim() || "This paper";

    const showTabs = highlights !== undefined;
    const onChatTab = !showTabs || tab === "chat";
    const tabIds = {
        chat: `${tabsId}-chat`,
        highlights: `${tabsId}-highlights`,
    };
    const panelIds = {
        chat: `${tabsId}-chat-panel`,
        highlights: `${tabsId}-highlights-panel`,
    };
    const chatPanelProps = showTabs
        ? {
              role: "tabpanel",
              id: panelIds.chat,
              "aria-labelledby": tabIds.chat,
          }
        : undefined;
    const sortedHighlights = useMemo(
        () =>
            [...(highlights || [])].sort(
                (left, right) =>
                    left.citation.startLine - right.citation.startLine,
            ),
        [highlights],
    );
    const askedQuestions = new Set(
        allMessages
            .filter((message) => message.sender === "user")
            .map((message) => message.message.trim().toLowerCase()),
    );
    const fallbackFollowUps = prompts.filter(
        (prompt) => !askedQuestions.has(prompt.toLowerCase()),
    );
    const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next: AssistantTab = tab === "chat" ? "highlights" : "chat";
        setTab(next);
        document.getElementById(tabIds[next])?.focus();
    };
    const tabList: Array<{ id: AssistantTab; label: string }> = [
        { id: "chat", label: "Chat" },
        {
            id: "highlights",
            label:
                sortedHighlights.length > 0
                    ? `Highlights · ${sortedHighlights.length}`
                    : "Highlights",
        },
    ];

    return (
        <div
            className={clsx(
                styles.chatpaperbox,
                hideComposer && styles.chatEmbedded,
                showTabs && styles.withTabs,
            )}
        >
            <header className={styles.chatHeader}>
                <span className={styles.chatMark} aria-hidden="true">
                    <SparkleIcon />
                </span>
                <div className={styles.chatHeading}>
                    <h2 className={styles.chatName}>Paper assistant</h2>
                    <p className={styles.chatRole} title={paperTitle}>
                        Uses Claude by Anthropic
                    </p>
                </div>
                {onClose && (
                    <button
                        type="button"
                        className={styles.chatClose}
                        aria-label="Close chat"
                        onClick={onClose}
                    >
                        ×
                    </button>
                )}
            </header>
            {showTabs && (
                <div
                    className={styles.tabs}
                    role="tablist"
                    aria-label="Paper assistant"
                >
                    {tabList.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            id={tabIds[item.id]}
                            aria-selected={tab === item.id}
                            aria-controls={panelIds[item.id]}
                            tabIndex={tab === item.id ? 0 : -1}
                            className={clsx(
                                styles.tab,
                                tab === item.id && styles.tabActive,
                            )}
                            onClick={() => setTab(item.id)}
                            onKeyDown={handleTabKey}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
            {isFreshChat ? (
                <div
                    className={styles.intro}
                    hidden={!onChatTab}
                    {...chatPanelProps}
                >
                    <p className={styles.introCopy}>{WELCOME_COPY}</p>
                    <div className={styles.nextQuestions}>
                        <p className={styles.nextLabel}>Try asking</p>
                        {prompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                className={styles.nextChip}
                                onClick={() => void sendTextMessage(prompt)}
                                disabled={loading || !chatMode}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <Messages
                    messages={allMessages}
                    loading={loading}
                    onLocate={locateCitation}
                    paper={wholePaper}
                    activeKey={locatedKey}
                    onAsk={chatMode ? (question) => void sendTextMessage(question) : undefined}
                    fallbackFollowUps={fallbackFollowUps}
                    hidden={!onChatTab}
                    panelProps={chatPanelProps}
                />
            )}
            {showTabs && tab === "highlights" && (
                <div
                    className={styles.highlightList}
                    role="tabpanel"
                    id={panelIds.highlights}
                    aria-labelledby={tabIds.highlights}
                >
                    {sortedHighlights.length === 0 ? (
                        <p className={styles.highlightEmpty}>
                            Turn on Highlight above the paper, then select a
                            passage. It will be saved here.
                        </p>
                    ) : (
                        sortedHighlights.map((highlight) => (
                            <article
                                key={highlight.id}
                                className={styles.highlightItem}
                            >
                                <span
                                    className={clsx(
                                        styles.highlightSection,
                                        HIGHLIGHT_DOT_CLASS[highlight.color],
                                    )}
                                >
                                    {highlight.citation.sectionTitle}
                                </span>
                                <p className={styles.highlightExcerpt}>
                                    “{highlight.excerpt}”
                                </p>
                                <div className={styles.highlightActions}>
                                    {locateCitation && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                locateCitation(
                                                    highlight.citation,
                                                )
                                            }
                                        >
                                            Show in paper
                                        </button>
                                    )}
                                    {chatMode === "full" && (
                                        <button
                                            type="button"
                                            className={styles.highlightChat}
                                            onClick={() =>
                                                attachCitation(
                                                    highlight.citation,
                                                )
                                            }
                                        >
                                            Add to chat
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))
                    )}
                    {highlightsSaved && sortedHighlights.length > 0 && (
                        <p className={styles.highlightFootnote}>
                            Saved to this paper · {sortedHighlights.length} of{" "}
                            {MAX_HIGHLIGHTS_PER_PAPER}
                        </p>
                    )}
                </div>
            )}
            {hideComposer ? null : (
            <Input
                input={inputMessage}
                setInput={setInputMessage}
                handleSubmit={handleSubmit}
                submitDisabled={
                    loading ||
                    !(canSendAttachmentImage || canSendCitation || canSendText)
                }
                attachment={pendingAttachment}
                citations={citations}
                onRemoveCitation={(index) =>
                    setCitations((current) =>
                        current.filter((_, item) => item !== index),
                    )
                }
                attachmentPreview={attachmentPreview}
                onRemoveAttachment={() => onPendingAttachmentChange?.(null)}
                onPasteImage={handlePasteImage}
                composerError={composerError}
                canAttachImages={canAnalyzeFigures}
            />
            )}
        </div>
    );
};

export default Chatbox;
