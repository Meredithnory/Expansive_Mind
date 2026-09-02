export const MAX_REGION_EXCERPT_CHARS = 4_000;

export function formatExcerptQuestion(question: string, excerpt: string) {
    const trimmedQuestion =
        question.trim() || "What does this selected excerpt mean?";
    const trimmedExcerpt = excerpt.replace(/\s+/g, " ").trim();
    if (!trimmedExcerpt) return trimmedQuestion;
    return `Regarding this selected excerpt from the paper:\n\n"""\n${trimmedExcerpt}\n"""\n\n${trimmedQuestion}`;
}

export function selectedTextFromRange(range: Range) {
    return range
        .toString()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_REGION_EXCERPT_CHARS);
}

export function selectionRectsRelativeTo(
    range: Range,
    element: HTMLElement,
) {
    const origin = element.getBoundingClientRect();
    return Array.from(range.getClientRects())
        .filter((rect) => rect.width >= 2 && rect.height >= 2)
        .map((rect) => ({
            left: rect.left - origin.left + element.scrollLeft,
            top: rect.top - origin.top + element.scrollTop,
            width: rect.width,
            height: rect.height,
        }));
}

export interface ExcerptTextPiece {
    text: string;
}

export interface LocatedExcerpt {
    startPieceIndex: number;
    startOffset: number;
    endPieceIndex: number;
    endOffset: number;
}

export function normalizeExcerpt(text: string) {
    return text
        .replace(/[\u2010-\u2015]/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D"]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

export function bestMatchingExcerpt(
    haystack: string,
    excerpt: string,
): string | null {
    const hay = normalizeExcerpt(haystack);
    const needle = normalizeExcerpt(excerpt);
    if (!hay || !needle) return null;
    if (hay.includes(needle)) return needle;

    const words = needle.split(" ").filter(Boolean);
    const minWindow = Math.min(6, words.length);
    for (let size = words.length; size >= minWindow; size -= 1) {
        for (let start = 0; start + size <= words.length; start += 1) {
            const window = words.slice(start, start + size).join(" ");
            if (window.length < 24 && size < words.length) continue;
            if (hay.includes(window)) return window;
        }
    }

    for (const length of [120, 80, 48]) {
        if (needle.length > length && hay.includes(needle.slice(0, length))) {
            return needle.slice(0, length);
        }
    }
    return null;
}

function normalizeExcerptChar(char: string) {
    if (/[\u2010-\u2015]/.test(char)) return "-";
    if (/[\u2018\u2019]/.test(char)) return "'";
    if (/[\u201C\u201D"]/.test(char)) return " ";
    return char.toLowerCase();
}

export function locateNormalizedExcerpt(
    pieces: ExcerptTextPiece[],
    excerpt: string,
): LocatedExcerpt | null {
    const needle = bestMatchingExcerpt(
        pieces.map((piece) => piece.text).join(""),
        excerpt,
    );
    if (!needle) return null;

    let haystack = "";
    const map: Array<{ pieceIndex: number; offset: number }> = [];
    let lastWasSpace = true;

    pieces.forEach((piece, pieceIndex) => {
        for (let offset = 0; offset < piece.text.length; offset += 1) {
            const folded = normalizeExcerptChar(piece.text[offset]);
            const isSpace = folded === " " || /\s/.test(folded);
            if (isSpace) {
                if (lastWasSpace) continue;
                haystack += " ";
                map.push({ pieceIndex, offset });
                lastWasSpace = true;
            } else {
                haystack += folded;
                map.push({ pieceIndex, offset });
                lastWasSpace = false;
            }
        }
    });

    if (haystack.endsWith(" ")) {
        haystack = haystack.slice(0, -1);
        map.pop();
    }

    const index = haystack.indexOf(needle);
    if (index < 0) return null;
    const start = map[index];
    const end = map[index + needle.length - 1];
    if (!start || !end) return null;
    return {
        startPieceIndex: start.pieceIndex,
        startOffset: start.offset,
        endPieceIndex: end.pieceIndex,
        endOffset: end.offset + 1,
    };
}

function collectPaperTextNodes(root: HTMLElement) {
    if (typeof document === "undefined") return [] as Text[];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest("[data-ink-layer]")) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        },
    });
    const nodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
        nodes.push(node as Text);
        node = walker.nextNode();
    }
    return nodes;
}

export function findExcerptRange(root: HTMLElement, excerpt: string) {
    const scope =
        (root.querySelector("[data-paper-body]") as HTMLElement | null) ||
        root;
    const nodes = collectPaperTextNodes(scope);
    const located = locateNormalizedExcerpt(
        nodes.map((node) => ({ text: node.textContent || "" })),
        excerpt,
    );
    if (!located) return null;
    const startNode = nodes[located.startPieceIndex];
    const endNode = nodes[located.endPieceIndex];
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(
        startNode,
        Math.min(located.startOffset, startNode.length),
    );
    range.setEnd(endNode, Math.min(located.endOffset, endNode.length));
    return range;
}

export type PaperTool = "highlight";
