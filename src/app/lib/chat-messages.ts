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
    "Ask where a method, readout, or limitation lives — I will point to it in the paper. I assume you already know the field.";

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
