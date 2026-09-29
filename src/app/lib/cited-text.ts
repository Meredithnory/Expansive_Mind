// Citations in report prose. The client turns them into "Paper N" chips;
// the server uses the same parser to record which evidence each chip cites.

export type CitedSegment =
    | { type: "text"; value: string }
    | { type: "cite"; index: number; label: string };

// Report prose cites papers in whatever shape the model wrote them:
// "[Paper 3]", "[Papers 2, 5]", "[1,6,9]", "[10]", "[Papers 7–9]", and in
// older briefs a bare "Paper 3" or "Papers 2 and 5". All become chips.
const NUMBER_LIST = String.raw`\d{1,3}(?:\s*(?:,|;|&|\band\b|–|—|-)\s*(?:and\s+)?\d{1,3})*`;
const CITATION_PATTERN = new RegExp(
    String.raw`\[\s*(?:Papers?\s+)?(${NUMBER_LIST})\s*\]|\bPapers\s+(${NUMBER_LIST})|\bPaper\s+(\d{1,3})\b`,
    "gi",
);

/** "1, 6 and 10" → [1, 6, 10]; "7–9" → [7, 8, 9]. Empty if any part isn't a number. */
function citationNumbers(list: string): number[] {
    const numbers: number[] = [];
    for (const part of list.split(/\s*(?:,|;|&|\band\b)\s*/i)) {
        const item = part.trim();
        if (!item) continue;
        const range = /^(\d{1,3})\s*[–—-]\s*(\d{1,3})$/.exec(item);
        if (range) {
            const from = Number(range[1]);
            const to = Number(range[2]);
            if (to < from || to - from > 20) return [];
            for (let number = from; number <= to; number += 1) numbers.push(number);
        } else if (/^\d{1,3}$/.test(item)) {
            numbers.push(Number(item));
        } else {
            return [];
        }
    }
    return [...new Set(numbers)];
}

type Token =
    | { type: "text"; value: string }
    | { type: "cite"; index: number; label: string; start: number };

function tokenizeCitations(content: string, paperCount: number): Token[] {
    const tokens: Token[] = [];
    const pushText = (value: string) => {
        if (!value) return;
        const last = tokens[tokens.length - 1];
        if (last?.type === "text") {
            last.value += value;
            return;
        }
        tokens.push({ type: "text", value });
    };

    let lastIndex = 0;
    for (const match of content.matchAll(CITATION_PATTERN)) {
        const start = match.index ?? 0;
        if (start > lastIndex) {
            pushText(content.slice(lastIndex, start));
        }
        const numbers = citationNumbers(match[1] ?? match[2] ?? match[3] ?? "");
        const valid =
            numbers.length > 0 &&
            numbers.every((index) => index >= 1 && index <= paperCount);
        if (valid) {
            numbers.forEach((index, position) => {
                if (position > 0) pushText(" ");
                tokens.push({ type: "cite", index, label: `Paper ${index}`, start });
            });
        } else {
            pushText(match[0]);
        }
        lastIndex = start + match[0].length;
    }
    if (lastIndex < content.length) {
        pushText(content.slice(lastIndex));
    }
    return tokens.length > 0 ? tokens : [{ type: "text", value: content }];
}

export function splitCitedText(
    content: string,
    paperCount: number,
): CitedSegment[] {
    return tokenizeCitations(content, paperCount).map((token) =>
        token.type === "cite"
            ? { type: "cite", index: token.index, label: token.label }
            : token,
    );
}

/** "E3.2" → 3. Evidence ids name their paper. */
export function evidencePaper(id: string): number | null {
    const match = /^E(\d{1,3})\.\d{1,2}$/.exec(id);
    return match ? Number(match[1]) : null;
}

const CITE_TOKEN = String.raw`(?:E\d{1,3}\.\d{1,2}|Papers?\s+\d{1,3}|\d{1,3})`;
const EVIDENCE_GROUP = new RegExp(
    String.raw`\[\s*(${CITE_TOKEN}(?:\s*(?:,|;|&|\band\b)\s*(?:and\s+)?${CITE_TOKEN})*)\s*\]`,
    "gi",
);

/**
 * The report writer cites evidence ids ("[E3.2]", "[E1.1, E6.3]"). Rewrite
 * them as plain "[Paper 3]" / "[Papers 1, 6]" so every other reader of the
 * text is unchanged, and return, per chip the client will render, the
 * evidence id it cites (null for a plain paper citation).
 */
export function normalizeEvidenceCitations(
    text: string,
    paperCount: number,
    knownIds: ReadonlySet<string>,
): { text: string; refs: Array<string | null> } {
    let out = "";
    let last = 0;
    const groupRefs: Array<{ at: number; refs: Array<string | null> }> = [];
    for (const match of text.matchAll(EVIDENCE_GROUP)) {
        if (!/E\d/i.test(match[1])) continue;
        const start = match.index ?? 0;
        out += text.slice(last, start);
        last = start + match[0].length;
        const cited = new Map<number, string | null>();
        for (const token of match[1].split(/\s*(?:,|;|&|\band\b)\s*/i)) {
            const item = token.replace(/^and\s+/i, "").trim();
            const id = item.toUpperCase();
            const paper = /^E/.test(id)
                ? evidencePaper(id)
                : Number(item.replace(/^Papers?\s+/i, ""));
            if (!paper || paper < 1 || paper > paperCount) continue;
            const ref = /^E/.test(id) && knownIds.has(id) ? id : null;
            if (!cited.has(paper) || (cited.get(paper) === null && ref)) {
                cited.set(paper, ref);
            }
        }
        if (cited.size === 0) {
            out = out.replace(/[ \t]+$/, "");
            continue;
        }
        const papers = [...cited.keys()];
        groupRefs.push({ at: out.length, refs: [...cited.values()] });
        out +=
            papers.length === 1
                ? `[Paper ${papers[0]}]`
                : `[Papers ${papers.join(", ")}]`;
    }
    out += text.slice(last);

    // Walk the chips the client will render and give each its evidence.
    const byStart = new Map(groupRefs.map((group) => [group.at, group.refs]));
    const refs: Array<string | null> = [];
    for (const token of tokenizeCitations(out, paperCount)) {
        if (token.type !== "cite") continue;
        refs.push(byStart.get(token.start)?.shift() ?? null);
    }
    return { text: out, refs };
}

const FIELD_KEY = /^[a-zA-Z]{1,24}(?:\.\d{1,2}(?:\.[a-zA-Z]{1,24})?)?$/;
const EVIDENCE_ID = /^E\d{1,3}\.\d{1,2}$/;

/** Read a stored `citationEvidence` map back; anything malformed is dropped. */
export function parseCitationEvidence(
    value: unknown,
): Record<string, Array<string | null>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const out: Record<string, Array<string | null>> = {};
    for (const [key, refs] of Object.entries(value as Record<string, unknown>)) {
        if (!FIELD_KEY.test(key) || !Array.isArray(refs) || refs.length > 200) continue;
        out[key] = refs.map((ref) =>
            typeof ref === "string" && EVIDENCE_ID.test(ref) ? ref : null,
        );
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
