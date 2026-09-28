import type { FormattedPaper, PaperFigure } from "../api/general-interfaces";
import type { FigureCaptureMethod } from "./figure-capture";

export interface ChatMessage {
    id: number | string;
    sender: string;
    message: string;
    timestamp: Date | string;
    animate?: boolean;
    imagePreview?: string;
}

export interface FigureAnalysisRequest {
    requestId: string;
    figure?: PaperFigure;
    image?: File;
    caption?: string;
    question?: string;
    captureMethod?: FigureCaptureMethod;
    rightsAttestation?: string;
}

export interface PendingChatAttachment {
    image?: File;
    excerpt?: string;
    captureMethod?: FigureCaptureMethod;
}

export const WELCOME_COPY =
    "Tell me what you want to understand or test. I’ll explain the evidence, point to the paper, and use your replies to help narrow the next question.";

export const WELCOME_MESSAGE: ChatMessage = {
    id: "welcome",
    sender: "ai",
    message: WELCOME_COPY,
    timestamp: new Date(),
    animate: false,
};

export const DEFAULT_PAPER_PROMPTS = [
    "Where is the key method described?",
    "What in this design should I not repeat?",
    "What limitation blocks the next experiment?",
] as const;

export function paperChatPrompts(
    paper?: Pick<FormattedPaper, "figures"> | null,
) {
    if (paper?.figures?.some((figure) => figure.canAnalyzeSourceImage)) {
        return [
            DEFAULT_PAPER_PROMPTS[0],
            "Walk me through the key figure.",
            DEFAULT_PAPER_PROMPTS[1],
            DEFAULT_PAPER_PROMPTS[2],
        ];
    }
    return [...DEFAULT_PAPER_PROMPTS];
}

export const buildChatMessages = (savedMessages: ChatMessage[] = []) =>
    savedMessages.filter((message) => message.id !== "welcome");

const MAX_FOLLOW_UPS = 3;
const FOLLOW_UP_MAX_CHARS = 120;
const NEXT_OPEN_RE = /(^|\n):::next[ \t]*(?=\n|$)/;
const BLOCK_CLOSE_RE = /(^|\n):::[ \t]*(?=\n|$)/;

/**
 * Splits the assistant's `:::next` block (questions the reader could ask
 * next) out of a reply. The block may be left unclosed at the end.
 */
export function splitFollowUps(message: string): {
    text: string;
    followUps: string[];
} {
    const open = message.match(NEXT_OPEN_RE);
    if (!open || open.index === undefined) {
        return { text: message, followUps: [] };
    }
    const bodyStart = open.index + open[0].length + 1;
    const rest = message.slice(bodyStart);
    const close = rest.match(BLOCK_CLOSE_RE);
    const body =
        close && close.index !== undefined ? rest.slice(0, close.index) : rest;
    const after =
        close && close.index !== undefined
            ? rest.slice(close.index + close[0].length)
            : "";
    const seen = new Set<string>();
    const followUps = body
        .split("\n")
        .map((line) =>
            line
                .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
                .replace(/^["“]|["”]$/g, "")
                .trim(),
        )
        .filter((line) => {
            const key = line.toLowerCase();
            if (!line || line.length > FOLLOW_UP_MAX_CHARS || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .slice(0, MAX_FOLLOW_UPS);
    const text = `${message.slice(0, open.index)}${after}`
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { text, followUps };
}
