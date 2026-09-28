// Evidence behind report citations: verify the model's quotes against the
// paper, and pick the quote a clicked "Paper N" chip should highlight.
import type { PaperEvidence } from "../api/discover/report-types";
import { evidencePaper } from "./cited-text";

export const EVIDENCE_QUOTE_MAX_CHARS = 300;
const EVIDENCE_QUOTE_MIN_CHARS = 25;

const FOLD: Record<string, string> = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "−": "-",
    " ": " ",
};

/** Lowercase, fold quotes and dashes, collapse whitespace; map back to the source. */
function fold(text: string) {
    let out = "";
    const at: number[] = [];
    let space = true;
    for (let i = 0; i < text.length; i += 1) {
        let ch = FOLD[text[i]] ?? text[i];
        if (/\s/.test(ch)) {
            if (space) continue;
            ch = " ";
            space = true;
        } else {
            space = false;
        }
        out += ch.toLowerCase();
        at.push(i);
    }
    if (out.endsWith(" ")) {
        out = out.slice(0, -1);
        at.pop();
    }
    return { out, at };
}

/**
 * The passage of `source` that `quote` copies, as the source writes it.
 * Only whitespace, quote marks, dashes, and case may differ; a trailing
 * ellipsis is ignored. Null if the quote isn't in the source.
 */
export function matchVerbatim(source: string, quote: string): string | null {
    const wanted = fold(quote.trim().replace(/(?:\.\.\.|…)$/, "")).out;
    if (wanted.length < EVIDENCE_QUOTE_MIN_CHARS) return null;
    const folded = fold(source);
    const start = folded.out.indexOf(wanted);
    if (start < 0) return null;
    const end = start + wanted.length - 1;
    return source.slice(folded.at[start], folded.at[end] + 1);
}

/**
 * Keep the findings whose quote is really in the excerpt, as E{paper}.{n}.
 * Nothing is kept for a paper that can't be quoted (license, abstract only).
 */
export function verifiedPaperEvidence(input: {
    paperIndex: number;
    excerpt: string;
    quotable: boolean;
    items: Array<{ finding: string; quote: string }>;
}): PaperEvidence[] {
    if (!input.quotable) return [];
    const evidence: PaperEvidence[] = [];
    const seen = new Set<string>();
    for (const item of input.items) {
        const finding = item.finding.trim();
        const quote = matchVerbatim(input.excerpt, item.quote);
        if (!finding || !quote || quote.length > EVIDENCE_QUOTE_MAX_CHARS) continue;
        if (seen.has(quote)) continue;
        seen.add(quote);
        evidence.push({
            id: `E${input.paperIndex}.${evidence.length + 1}`,
            finding,
            quote,
        });
    }
    return evidence;
}

const STOP = new Set(
    "a an and are as at be by for from has have in into is it its of on or that the their these this those to was were which with".split(" "),
);

function contentWords(text: string) {
    return new Set(
        (text.toLowerCase().match(/[\p{L}\p{N}-]{3,}/gu) ?? []).filter(
            (word) => !STOP.has(word),
        ),
    );
}

export type CiteContext = {
    /** The evidence id the report recorded for this chip. */
    evidenceId?: string | null;
    /** The sentence the chip sits in, to match when no id was recorded. */
    context?: string;
};

/**
 * The passage a chip for paper `paperIndex` should highlight: the evidence
 * the report cited, else the paper's evidence closest to the chip's
 * sentence, else null (the caller falls back to the paper's excerpt).
 */
export function citedEvidenceQuote(
    evidence: PaperEvidence[] | undefined,
    paperIndex: number,
    cite: CiteContext = {},
): string | null {
    const items = (evidence ?? []).filter((item) => evidencePaper(item.id) === paperIndex);
    if (items.length === 0) return null;
    if (cite.evidenceId) {
        const exact = items.find((item) => item.id === cite.evidenceId);
        if (exact) return exact.quote;
    }
    if (!cite.context) return null;
    const words = contentWords(cite.context);
    let best: { quote: string; score: number } | null = null;
    for (const item of items) {
        const theirs = contentWords(`${item.finding} ${item.quote}`);
        let shared = 0;
        for (const word of theirs) if (words.has(word)) shared += 1;
        const score = shared / Math.max(1, Math.min(words.size, theirs.size));
        if (!best || score > best.score) best = { quote: item.quote, score };
    }
    // Only a clear match; a weak one would point at the wrong evidence.
    return best && best.score >= 0.34 ? best.quote : null;
}

/** The evidence a gap cites for one of its papers, from the gap's own text. */
export function gapEvidenceId(
    citationEvidence: Record<string, Array<string | null>> | undefined,
    gapIndex: number,
    paperIndex: number,
): string | null {
    for (const field of ["description", "whyItMatters", "title"]) {
        for (const id of citationEvidence?.[`gaps.${gapIndex}.${field}`] ?? []) {
            if (id && evidencePaper(id) === paperIndex) return id;
        }
    }
    return null;
}
