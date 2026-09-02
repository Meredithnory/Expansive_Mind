"use client";
import React, {
    useState,
    useRef,
    useEffect,
    SetStateAction,
    useCallback,
    useMemo,
} from "react";
import styles from "../styles/chatbox.module.scss";
import clsx from "clsx";
import { FormattedPaper } from "../../api/general-interfaces";
import ReactMarkdown from "react-markdown";
import type {
    ChatMessage,
    FigureAnalysisRequest,
    PendingChatAttachment,
} from "../../lib/chat-messages";
import {
    WELCOME_COPY,
    paperChatPrompts,
} from "../../lib/chat-messages";
import { FIGURE_RIGHTS_ATTESTATION_VERSION } from "../../lib/figure-capture";
import { MAX_CAPTURE_BYTES } from "../../lib/canvas-image";
import { formatExcerptQuestion } from "../../lib/region-capture";
import {
    citationLabel,
    citationPreviewRows,
    encodeCitedMessage,
    parseCitedMessage,
    type PaperCitation,
} from "../../lib/paper-citation";
import { useSession } from "../../lib/use-session";

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

const MARKDOWN_TICK_MS = 40;

const Message = React.memo(function Message({
    message,
    onContentUpdate,
    animate,
    isLastMessage,
}: {
    message: string;
    animate: boolean;
    isLastMessage: boolean;
    onContentUpdate: () => void;
}) {
    const shouldAnimate = animate && isLastMessage;
    const [content, setContent] = useState(() =>
        shouldAnimate ? "" : message,
    );

    useEffect(() => {
        if (!shouldAnimate) {
            setContent(message);
            return;
        }

        let offset = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const chunkSize = Math.max(3, Math.ceil(message.length / 90));

        setContent("");
        const revealChunk = () => {
            offset = Math.min(message.length, offset + chunkSize);
            setContent(message.slice(0, offset));
            onContentUpdate();
            if (offset < message.length) {
                timer = setTimeout(revealChunk, MARKDOWN_TICK_MS);
            }
        };
        timer = setTimeout(revealChunk, MARKDOWN_TICK_MS);

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [message, onContentUpdate, shouldAnimate]);

    return (
        <div className={styles.prose}>
            <ReactMarkdown
                components={{
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noreferrer">
                            {children}
                        </a>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
});

const CitationCard = ({
    citation,
    compact = false,
    onRemove,
    onLocate,
}: {
    citation: PaperCitation;
    compact?: boolean;
    onRemove?: () => void;
    onLocate?: (citation: PaperCitation) => void;
}) => {
    const rows = citationPreviewRows(citation);
    const locate = onLocate ? () => onLocate(citation) : undefined;
    return (
        <div
            className={clsx(
                styles.citation,
                compact && styles.citationCompact,
                locate && styles.citationButton,
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
                        ? `line ${citation.startLine}`
                        : `lines ${citation.startLine}–${citation.endLine}`}
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
                    >
                        Show in paper
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
            {!compact && (
                <pre className={styles.citationBody}>
                    {rows.map((row) =>
                        row.ellipsis ? (
                            <span
                                key="ellipsis"
                                className={styles.citationEllipsis}
                            >
                                ···
                            </span>
                        ) : (
                            <span
                                key={row.number}
                                className={styles.citationLine}
                            >
                                <span className={styles.citationGutter}>
                                    {row.number}
                                </span>
                                <span className={styles.citationText}>
                                    {row.text}
                                </span>
                            </span>
                        ),
                    )}
                </pre>
            )}
        </div>
    );
};

const UserTurn = ({
    message,
    onLocate,
}: {
    message: ChatMessage;
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
    copiedId,
    onCopy,
    onLocate,
}: {
    messages: ChatMessage[];
    loading: boolean;
    copiedId: string | null;
    onCopy: (id: string, text: string) => void;
    onLocate?: (citation: PaperCitation) => void;
}) => {
    const messagesRef = useRef<HTMLDivElement>(null);
    const scrollFrameRef = useRef<number | null>(null);

    const scrollToBottom = useCallback(() => {
        if (scrollFrameRef.current !== null) return;
        scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            const element = messagesRef.current;
            if (element) element.scrollTop = element.scrollHeight;
        });
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(scrollToBottom, 120);
        return () => window.clearTimeout(timer);
    }, [loading, messages, scrollToBottom]);

    useEffect(
        () => () => {
            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
            }
        },
        [],
    );

    return (
        <div className={styles.messages} ref={messagesRef}>
            {messages.map((msg: ChatMessage, index) => {
                if (msg.sender === "ai") {
                    const parsed = parseCitedMessage(msg.message);
                    const copyText = [
                        ...parsed.citations.map(
                            (citation) =>
                                `${citation.sectionTitle}: ${citation.lines.join(" ")}`,
                        ),
                        parsed.question,
                    ]
                        .filter(Boolean)
                        .join("\n\n");
                    return (
                        <article
                            key={msg.id}
                            className={clsx(styles.turn, styles.turnAssistant)}
                        >
                            <div className={styles.turnMeta}>
                                <span className={styles.turnMark} aria-hidden="true" />
                                Assistant
                            </div>
                            <div className={clsx(styles.message, styles.aiMessage)}>
                                {parsed.citations.length > 0 ? (
                                    <div className={styles.citationStack}>
                                        {parsed.citations.map(
                                            (citation, citeIndex) => (
                                                <CitationCard
                                                    key={`${citation.sectionTitle}-${citation.startLine}-${citeIndex}`}
                                                    citation={citation}
                                                    onLocate={onLocate}
                                                />
                                            ),
                                        )}
                                    </div>
                                ) : null}
                                {parsed.question ? (
                                    <Message
                                        message={parsed.question}
                                        animate={Boolean(msg.animate)}
                                        isLastMessage={
                                            index === messages.length - 1
                                        }
                                        onContentUpdate={scrollToBottom}
                                    />
                                ) : null}
                                <button
                                    type="button"
                                    className={styles.copyButton}
                                    onClick={() =>
                                        onCopy(
                                            String(msg.id),
                                            copyText || msg.message,
                                        )
                                    }
                                >
                                    {copiedId === String(msg.id)
                                        ? "Copied"
                                        : "Copy"}
                                </button>
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
                            <div className={styles.turnMeta}>You</div>
                            <div className={styles.userTurnWrap}>
                                {msg.imagePreview && (
                                    <img
                                        className={styles.messageScreenshot}
                                        src={msg.imagePreview}
                                        alt="Attached screenshot"
                                    />
                                )}
                                <UserTurn message={msg} onLocate={onLocate} />
                            </div>
                        </article>
                    );
                }
                return (
                    <article
                        key={msg.id}
                        className={clsx(styles.turn, styles.turnUser)}
                    >
                        <div className={styles.turnMeta}>You</div>
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
            {loading && (
                <article className={clsx(styles.turn, styles.turnAssistant)}>
                    <div className={styles.turnMeta}>
                        <span className={styles.turnMark} aria-hidden="true" />
                        Assistant
                    </div>
                    <div
                        className={clsx(styles.message, styles.aiMessage)}
                        aria-live="polite"
                        aria-label="Assistant is thinking"
                    >
                        <div className={styles.typing}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </article>
            )}
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
    const hint = attachment?.image
        ? "Ask about this screenshot · Enter to send"
        : citations.length > 0
          ? "Ask about the attached excerpt · Enter to send"
          : "Highlight a passage to cite it · Enter to send";

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
                            Screenshot analysis is available with Researcher
                            Pro.
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
                                  : "Ask this paper…"
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
    onLocateCitation?: (citation: PaperCitation) => void;
}

const Chatbox = ({
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
    onLocateCitation,
}: ChatboxProps) => {
    const { refresh } = useSession();
    const [inputMessage, setInputMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [composerError, setComposerError] = useState("");
    const [attachmentPreview, setAttachmentPreview] = useState("");
    const [citations, setCitations] = useState<PaperCitation[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const handledFigureRequest = useRef<string | null>(null);
    const sentScreenshotUrls = useRef<string[]>([]);
    const prompts = useMemo(
        () => paperChatPrompts(wholePaper),
        [wholePaper],
    );
    const isFreshChat = allMessages.length === 0 && !loading;

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
        if (!pendingInsert) return;
        setCitations((current) => {
            if (
                current.some(
                    (citation) =>
                        citation.sectionTitle === pendingInsert.sectionTitle &&
                        citation.startLine === pendingInsert.startLine &&
                        citation.endLine === pendingInsert.endLine,
                )
            ) {
                return current;
            }
            return [...current, pendingInsert];
        });
        onPendingInsertHandled?.();
        window.requestAnimationFrame(() => {
            document.getElementById("messageInput")?.focus();
        });
    }, [onPendingInsertHandled, pendingInsert]);

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

    const handleCopy = useCallback(async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            window.setTimeout(() => {
                setCopiedId((current) => (current === id ? null : current));
            }, 1600);
        } catch {
            setComposerError("The reply could not be copied.");
        }
    }, []);

    const sendTextMessage = async (
        messageText: string,
        displayMessage?: string,
    ) => {
        if (
            !messageText.trim() ||
            !wholePaper ||
            !wholePaper.access.canSendToAI ||
            !wholePaper.source
        ) {
            return;
        }

        onSubmitStart?.();
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
                    displayMessage: displayMessage || messageText,
                    database: wholePaper.source,
                    paperId: wholePaper.paperId,
                    idName: wholePaper.idName,
                }),
            });
            const data = await res.json();
            void refresh();

            if (!res.ok || !data.aiResponse) {
                throw new Error(data.error || "Failed to save conversation.");
            }

            const aiResponse = {
                ...data.aiResponse,
                animate: true,
            };
            setAllMessages((prevMessages) => [...prevMessages, aiResponse]);
        } catch {
            console.error("Chat request failed");
            setAllMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: `local-error-${Date.now()}`,
                    sender: "ai",
                    message:
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
                    { ...data.aiResponse, animate: false },
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
            setComposerError(
                "Screenshot analysis is available with Researcher Pro.",
            );
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
            if (!canAnalyzeFigures) return;
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

        if (citations.length > 0) {
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
        pendingAttachment?.image && canAnalyzeFigures,
    );
    const canSendCitation = Boolean(
        citations.length > 0 && wholePaper?.access.canSendToAI,
    );
    const canSendText = Boolean(
        inputMessage.trim() && wholePaper?.access.canSendToAI,
    );
    const paperTitle = wholePaper?.title?.trim() || "This paper";

    return (
        <div className={styles.chatpaperbox}>
            <header className={styles.chatHeader}>
                <div className={styles.chatIdentity}>
                    <span className={styles.chatMark} aria-hidden="true" />
                    <div className={styles.chatHeading}>
                        <p className={styles.chatEyebrow}>Paper assistant</p>
                        <h2 className={styles.chatTitle} title={paperTitle}>
                            {paperTitle}
                        </h2>
                    </div>
                </div>
                <p className={styles.chatMeta}>
                    Answers stay grounded in this article.
                </p>
            </header>
            {isFreshChat ? (
                <div className={styles.intro}>
                    <p className={styles.introCopy}>{WELCOME_COPY}</p>
                    <div className={styles.promptRail}>
                        {prompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                className={styles.promptChip}
                                onClick={() => void sendTextMessage(prompt)}
                                disabled={
                                    loading || !wholePaper?.access.canSendToAI
                                }
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
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onLocate={onLocateCitation}
                />
            )}
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
        </div>
    );
};

export default Chatbox;
