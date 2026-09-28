// Evidence behind report citations: verify the model's quotes against the
// paper, and pick the quote a clicked "Paper N" chip should highlight.
import type { EvidenceAnchor, PaperEvidence } from "../api/discover/report-types";
import { evidencePaper } from "./cited-text";
import { buildPaperFocusHref } from "./paper-sources";

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

/** cyrb53: a fast 53-bit string hash, the same in Node and the browser. */
function cyrb53(text: string) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** A sentence's fingerprint: where to find it, without keeping its words. */
export function evidenceAnchor(sentence: string): EvidenceAnchor {
    const folded = fold(sentence).out;
    return { hash: cyrb53(folded), length: folded.length };
}

/**
 * The sentence in `text` whose fingerprint is `anchor`, as the text writes
 * it; null when the paper doesn't contain it (e.g. its text changed).
 */
export function findAnchoredSentence(text: string, anchor: EvidenceAnchor): string | null {
    const folded = fold(text);
    const { length } = anchor;
    if (length < EVIDENCE_QUOTE_MIN_CHARS || length > folded.out.length) return null;
    for (let start = 0; start + length <= folded.out.length; start += 1) {
        // A sentence never starts on a space.
        if (folded.out[start] === " ") continue;
        if (cyrb53(folded.out.slice(start, start + length)) === anchor.hash) {
            return text.slice(folded.at[start], folded.at[start + length - 1] + 1);
        }
    }
    return null;
}

/** The text a loaded paper shows, where an anchored sentence is looked up. */
export function paperSearchText(paper: {
    abstract?: string;
    paper?: Array<{ content?: string; subSections?: Array<{ content?: string }> }>;
}): string {
    return [
        paper.abstract ?? "",
        ...(paper.paper ?? []).flatMap((section) => [
            section.content ?? "",
            ...(section.subSections ?? []).map((sub) => sub.content ?? ""),
        ]),
    ]
        .filter(Boolean)
        .join("\n");
}

export function isEvidenceAnchor(value: unknown): value is EvidenceAnchor {
    if (!value || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    return (
        typeof row.hash === "string" &&
        /^[0-9a-f]{1,16}$/.test(row.hash) &&
        typeof row.length === "number" &&
        Number.isInteger(row.length) &&
        row.length >= EVIDENCE_QUOTE_MIN_CHARS &&
        row.length <= 400
    );
}

/**
 * Keep the findings whose sentence is really in the excerpt, as E{paper}.{n}.
 * Every kept item gets an anchor so the reader can highlight it; the
 * sentence itself is stored only when the paper can be quoted.
 */
export function verifiedPaperEvidence(input: {
    paperIndex: number;
    excerpt: string;
    quotable: boolean;
    items: Array<{ finding: string; quote: string }>;
}): PaperEvidence[] {
    const evidence: PaperEvidence[] = [];
    const seen = new Set<string>();
    for (const item of input.items) {
        const finding = item.finding.trim();
        const sentence = matchVerbatim(input.excerpt, item.quote);
        if (!finding || !sentence || sentence.length > EVIDENCE_QUOTE_MAX_CHARS) continue;
        if (seen.has(sentence)) continue;
        seen.add(sentence);
        evidence.push({
            id: `E${input.paperIndex}.${evidence.length + 1}`,
            finding,
            anchor: evidenceAnchor(sentence),
            ...(input.quotable ? { quote: sentence } : {}),
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
export function citedEvidence(
    evidence: PaperEvidence[] | undefined,
    paperIndex: number,
    cite: CiteContext = {},
): PaperEvidence | null {
    const items = (evidence ?? []).filter((item) => evidencePaper(item.id) === paperIndex);
    if (items.length === 0) return null;
    if (cite.evidenceId) {
        const exact = items.find((item) => item.id === cite.evidenceId);
        if (exact) return exact;
    }
    if (!cite.context) return null;
    const words = contentWords(cite.context);
    let best: { item: PaperEvidence; score: number } | null = null;
    for (const item of items) {
        const theirs = contentWords(`${item.finding} ${item.quote ?? ""}`);
        let shared = 0;
        for (const word of theirs) if (words.has(word)) shared += 1;
        const score = shared / Math.max(1, Math.min(words.size, theirs.size));
        if (!best || score > best.score) best = { item, score };
    }
    // Only a clear match; a weak one would point at the wrong evidence.
    return best && best.score >= 0.34 ? best.item : null;
}

export function citedEvidenceQuote(
    evidence: PaperEvidence[] | undefined,
    paperIndex: number,
    cite: CiteContext = {},
): string | null {
    return citedEvidence(evidence, paperIndex, cite)?.quote ?? null;
}

/**
 * The passage to highlight for an evidence item in a loaded paper: its
 * stored sentence, else the sentence its anchor finds in the paper's text.
 */
export function evidencePassage(
    item: Pick<PaperEvidence, "quote" | "anchor"> | null | undefined,
    paperText: string,
): string | null {
    if (!item) return null;
    if (item.quote) return item.quote;
    return item.anchor ? findAnchoredSentence(paperText, item.anchor) : null;
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

/**
 * A reader link that opens at an evidence sentence: the sentence itself
 * when we may keep it, otherwise its fingerprint (`?anchor=hash.length`).
 */
export function evidenceFocusHref(
    href: string,
    item: Pick<PaperEvidence, "quote" | "anchor"> | null | undefined,
): string {
    if (item?.quote) return buildPaperFocusHref(href, item.quote, { method: false });
    if (!item?.anchor || !href.startsWith("/paperchatbot/")) return href;
    const [path, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    params.set("anchor", `${item.anchor.hash}.${item.anchor.length}`);
    return `${path}?${params}`;
}

/** `?anchor=hash.length` back to a fingerprint. */
export function parseAnchorParam(value: string | null | undefined): EvidenceAnchor | null {
    const match = /^([0-9a-f]{1,16})\.(\d{1,3})$/.exec(value ?? "");
    if (!match) return null;
    const anchor = { hash: match[1], length: Number(match[2]) };
    return isEvidenceAnchor(anchor) ? anchor : null;
}
