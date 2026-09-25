import type { FormattedPaper } from "../api/general-interfaces";
import { normalizePaperDoi } from "./paper-impact";
import {
    buildPaperLines,
    locateExcerptInPaper,
    type PaperCitation,
} from "./paper-citation";

export type CitedSourceQuery = {
    title: string;
    doi?: string | null;
    authors?: string[];
    year?: number | string | null;
};

const fold = (value: string) =>
    value
        .replace(/[\u2010-\u2015]/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D"]/g, " ")
        .toLowerCase();

const isReferenceSection = (title: string) =>
    /reference|bibliograph|literature cited|works cited|citations/i.test(
        title.trim(),
    );

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const authorLastNames = (authors: string[] | undefined) =>
    (authors || [])
        .map((author) => {
            const cleaned = author.replace(/\s+/g, " ").trim();
            if (!cleaned) return "";
            if (cleaned.includes(",")) {
                return cleaned.split(",")[0]?.trim() || "";
            }
            const parts = cleaned.split(" ").filter(Boolean);
            return parts[parts.length - 1] || "";
        })
        .filter((name) => name.length >= 2);

const titlePhrase = (title: string) => {
    const words = title
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 2);
    return words.slice(0, 8).join(" ");
};

const excerptAround = (
    haystack: string,
    index: number,
    length: number,
    pad = 48,
) => {
    const start = Math.max(0, index - pad);
    const end = Math.min(haystack.length, index + length + pad);
    return haystack.slice(start, end).replace(/\s+/g, " ").trim();
};

const scoreMatch = (sectionTitle: string, index: number) => {
    let score = isReferenceSection(sectionTitle) ? 8 : 2;
    // Prefer earlier reference hits slightly.
    score += Math.max(0, 2 - index / 5000);
    return score;
};

/**
 * Find text in `paper` (B) that cites `source` (A).
 * Returns a real PaperCitation only when a matching span exists in B.
 */
export function findCitedSourceInPaper(
    paper: FormattedPaper,
    source: CitedSourceQuery,
): PaperCitation | null {
    const lines = buildPaperLines(paper);
    if (lines.length === 0) return null;

    const haystack = lines.map((line) => line.text).join(" ");
    if (!haystack.trim()) return null;

    type Candidate = { excerpt: string; sectionHint: string; score: number };
    const candidates: Candidate[] = [];

    const pushCandidate = (index: number, length: number) => {
        if (index < 0 || length <= 0) return;
        let cursor = 0;
        let sectionTitle = lines[0]?.sectionTitle || "Paper";
        for (const line of lines) {
            const next = cursor + line.text.length + 1;
            if (index >= cursor && index < next) {
                sectionTitle = line.sectionTitle;
                break;
            }
            cursor = next;
        }
        const excerpt = excerptAround(haystack, index, length);
        if (excerpt.length < 8) return;
        candidates.push({
            excerpt,
            sectionHint: sectionTitle,
            score: scoreMatch(sectionTitle, index),
        });
    };

    const doi = normalizePaperDoi(source.doi);
    if (doi) {
        const doiMatch = haystack.match(new RegExp(escapeRegExp(doi), "i"));
        if (doiMatch?.index != null) {
            pushCandidate(doiMatch.index, doiMatch[0].length);
        }
    }

    const phrase = titlePhrase(source.title || "");
    if (phrase.length >= 12) {
        const foldedHay = fold(haystack);
        const foldedPhrase = fold(phrase);
        let from = 0;
        while (from < foldedHay.length) {
            const found = foldedHay.indexOf(foldedPhrase, from);
            if (found < 0) break;
            // Map folded index approximately by searching original for a distinctive token.
            const anchor = phrase.split(/\s+/).slice(0, 3).join(" ");
            const approx = haystack.toLowerCase().indexOf(anchor.toLowerCase(), Math.max(0, found - 20));
            const index = approx >= 0 ? approx : found;
            pushCandidate(index, Math.min(phrase.length + 20, haystack.length - index));
            from = found + Math.max(1, foldedPhrase.length);
        }
    }

    const yearRaw =
        typeof source.year === "number"
            ? String(source.year)
            : typeof source.year === "string"
              ? source.year.trim()
              : "";
    const yearMatch = yearRaw.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch?.[0] || "";
    const lastNames = authorLastNames(source.authors);
    if (phrase.length >= 8 && lastNames.length > 0) {
        const shortTitle = phrase.split(/\s+/).slice(0, 4).join(" ");
        for (const lastName of lastNames.slice(0, 2)) {
            const pattern = year
                ? new RegExp(
                      `${escapeRegExp(lastName)}.{0,80}${escapeRegExp(year)}.{0,120}${escapeRegExp(shortTitle)}|${escapeRegExp(shortTitle)}.{0,120}${escapeRegExp(lastName)}.{0,40}${escapeRegExp(year)}`,
                      "i",
                  )
                : new RegExp(
                      `${escapeRegExp(lastName)}.{0,100}${escapeRegExp(shortTitle)}|${escapeRegExp(shortTitle)}.{0,100}${escapeRegExp(lastName)}`,
                      "i",
                  );
            const match = haystack.match(pattern);
            if (match?.index != null) {
                pushCandidate(match.index, match[0].length);
            }
        }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const citation = locateExcerptInPaper(
        paper,
        best.excerpt,
        best.sectionHint,
    );
    // locateExcerptInPaper always returns something; require the joined lines
    // to actually appear (folded) in the paper haystack.
    const joined = citation.lines.join(" ").replace(/\s+/g, " ").trim();
    if (!joined || !fold(haystack).includes(fold(joined).slice(0, 40))) {
        // Fall back to exact excerpt slice if locate widened poorly.
        if (fold(haystack).includes(fold(best.excerpt).slice(0, 40))) {
            return locateExcerptInPaper(paper, best.excerpt, best.sectionHint);
        }
        return null;
    }
    return citation;
}

export const CITE_FOCUS_STORAGE_KEY = "expansive-cite-focus-v1";

export function storeCiteFocusSource(source: CitedSourceQuery) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(
            CITE_FOCUS_STORAGE_KEY,
            JSON.stringify({
                title: source.title,
                doi: source.doi || undefined,
                authors: source.authors || [],
                year: source.year ?? undefined,
            }),
        );
    } catch {
        // Ignore quota / private mode failures; navigation still works.
    }
}

export function consumeCiteFocusSource(): CitedSourceQuery | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(CITE_FOCUS_STORAGE_KEY);
        sessionStorage.removeItem(CITE_FOCUS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CitedSourceQuery;
        if (!parsed?.title || typeof parsed.title !== "string") return null;
        return parsed;
    } catch {
        return null;
    }
}
