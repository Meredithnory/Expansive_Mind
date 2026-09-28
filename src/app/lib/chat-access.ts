import { isScholarSnippetSource } from "./quote-eligibility";

export type PaperChatMode = "full" | "abstract" | null;

/**
 * What the assistant may read for a paper. Licensed papers use excerpts from
 * the body. Other papers use the abstract only, like abstract-first research
 * tools. Scholar snippets are never sent to the model.
 */
export function paperChatMode(paper: {
    source?: string | null;
    contentLabel?: string | null;
    abstract?: string | null;
    access: { canSendToAI: boolean };
}): PaperChatMode {
    if (isScholarSnippetSource(paper)) return null;
    if (paper.access.canSendToAI) return "full";
    return paper.abstract?.trim() ? "abstract" : null;
}
