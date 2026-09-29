import type {
    DiscoverPaperCard,
    OpportunityReport,
} from "../api/discover/report-types";
import { normalizeLicense } from "../lib/content-access-policy";
import { splitCitedText } from "../lib/cited-text";
import { PAPER_SOURCES } from "../lib/paper-sources";
import {
    isCommercialFriendlyLicenseUri,
    resolvableQuoteLink,
    type QuoteGateReason,
} from "../lib/quote-eligibility";
import { splitParagraphs } from "./report-text";

export type ProvenancePaper = Pick<
    DiscoverPaperCard,
    | "index"
    | "database"
    | "paperId"
    | "idName"
    | "title"
    | "sourceUrl"
    | "href"
    | "doi"
    | "indexedBy"
    | "licenseUrl"
    | "quoteGate"
>;

/** A place in the write-up that cites a paper. */
export interface ProvenanceClaim {
    /** "Gap 2", "State of the science". */
    where: string;
    /** The write-up's own words, citations removed. */
    text: string;
}

export type QuoteStatus = "allowed" | "blocked" | "unrecorded";

export interface PaperProvenance {
    index: number;
    title: string;
    /** Where the text and license were read from. */
    source: string;
    /** Indexes that also returned the paper (OpenAlex, Europe PMC, Google Scholar). */
    foundVia: string[];
    pmcid: { id: string; href: string } | null;
    link: { href: string; label: string; external: boolean } | null;
    claims: ProvenanceClaim[];
    quote: { status: QuoteStatus; label: string; detail: string };
}

const CLAIM_MAX_CHARS = 180;

// Split after . ! ? when a new sentence starts. A citation after the period
// ("risk. [Paper 3]") stays with the sentence before it.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/;

function clip(text: string, max = CLAIM_MAX_CHARS): string {
    if (text.length <= max) return text;
    const slice = text.slice(0, max - 1);
    const breakAt = slice.lastIndexOf(" ");
    return `${(breakAt > max * 0.6 ? slice.slice(0, breakAt) : slice).replace(/[\s,;:]+$/, "")}…`;
}

function citedIn(text: string | undefined, paperCount: number): number[] {
    if (!text) return [];
    return splitCitedText(text, paperCount).flatMap((segment) =>
        segment.type === "cite" ? [segment.index] : [],
    );
}

/** The sentence with its citations and markdown markers taken out. */
function plainText(text: string, paperCount: number): string {
    return splitCitedText(text, paperCount)
        .map((segment) => (segment.type === "text" ? segment.value : ""))
        .join("")
        .replace(/^\s*(?:#{1,6}|[-*•]|\d+[.)])\s+/, "")
        .replace(/\*\*|__/g, "")
        .replace(/\(\s*\)|\[\s*\]/g, "")
        .replace(/\s+([.,;:!?])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

type ClaimSink = (paper: number, claim: ProvenanceClaim) => void;

function addProse(
    add: ClaimSink,
    text: string,
    where: string,
    paperCount: number,
) {
    for (const paragraph of splitParagraphs(text)) {
        for (const sentence of paragraph.split(SENTENCE_BREAK)) {
            const cited = citedIn(sentence, paperCount);
            if (cited.length === 0) continue;
            const plain = plainText(sentence, paperCount);
            if (!plain) continue;
            for (const paper of cited) add(paper, { where, text: clip(plain) });
        }
    }
}

function addItem(
    add: ClaimSink,
    where: string,
    title: string,
    fields: Array<string | undefined>,
    citations: number[],
    paperCount: number,
) {
    const cited = new Set(
        citations.filter(
            (index) => Number.isInteger(index) && index >= 1 && index <= paperCount,
        ),
    );
    for (const field of [title, ...fields]) {
        for (const index of citedIn(field, paperCount)) cited.add(index);
    }
    const text = clip(plainText(title, paperCount));
    if (!text) return;
    for (const paper of cited) add(paper, { where, text });
}

/**
 * Every place in the write-up that cites each paper, in reading order: an
 * explicit citation list or a "Paper N" chip in the item's text. A problem
 * that only points at a gap does not cite that gap's papers itself.
 */
export function claimsByPaper(
    report: OpportunityReport | null | undefined,
    brief: string,
    paperCount: number,
): Map<number, ProvenanceClaim[]> {
    const claims = new Map<number, ProvenanceClaim[]>();
    const add: ClaimSink = (paper, claim) => {
        const list = claims.get(paper) ?? [];
        if (!list.some((item) => item.where === claim.where && item.text === claim.text)) {
            list.push(claim);
        }
        claims.set(paper, list);
    };

    if (!report) {
        addProse(add, brief, "Brief", paperCount);
        return claims;
    }

    const { sections } = report;
    addProse(add, sections.stateOfScience, "State of the science", paperCount);
    sections.gaps.forEach((gap, index) =>
        addItem(
            add,
            `Gap ${index + 1}`,
            gap.title,
            [gap.description, gap.whyItMatters, gap.scopeNote],
            gap.citations ?? [],
            paperCount,
        ),
    );
    sections.problems.forEach((problem, index) =>
        addItem(add, `Problem ${index + 1}`, problem.title, [problem.description], [], paperCount),
    );
    sections.projectSeeds.forEach((seed, index) =>
        addItem(add, `Experiment ${index + 1}`, seed.title, [seed.oneLiner], [], paperCount),
    );
    sections.venturePotential.forEach((item, index) =>
        addItem(
            add,
            `Translation ${index + 1}`,
            item.title,
            [item.thesis, item.feasibilitySignals, item.risks],
            item.citations ?? [],
            paperCount,
        ),
    );
    sections.couldNotVerify.forEach((item) =>
        addProse(add, item, "What we could not verify", paperCount),
    );
    return claims;
}

const BLOCKED_DETAIL: Record<Exclude<QuoteGateReason, "ok" | "no_passage">, string> = {
    scholar_snippet: "Google Scholar returns a search snippet, not the paper’s text.",
    abstract_only: "Only the abstract was read. Abstracts are not quoted.",
    null_license: "License unknown. Unknown licenses are not quoted.",
    license_not_commercial_friendly: "License is not CC0, CC BY, CC BY-SA, or CC BY-ND.",
    license_conflict: "License records disagree.",
    missing_attribution: "No title or link to credit a quote.",
};

/**
 * Allowed only when the card carries a commercial-friendly license URI, the
 * same field every quote display checks. Anything else is blocked.
 */
export function quoteStatus(paper: ProvenancePaper): PaperProvenance["quote"] {
    const gate =
        paper.quoteGate ?? (paper.database === "scholar" ? "scholar_snippet" : undefined);
    if (isCommercialFriendlyLicenseUri(paper.licenseUrl) && (!gate || gate === "ok")) {
        return {
            status: "allowed",
            label: "Allowed",
            detail: normalizeLicense(null, paper.licenseUrl).licenseName ?? "Open license",
        };
    }
    if (gate === "no_passage") {
        return {
            status: "allowed",
            label: "Allowed",
            detail: "No passage was quoted.",
        };
    }
    if (!gate) {
        return {
            status: "unrecorded",
            label: "Not quoted",
            detail: "Reason not recorded for this run.",
        };
    }
    // "ok" without a usable license URI fails closed like an unknown license.
    return {
        status: "blocked",
        label: "Blocked",
        detail: BLOCKED_DETAIL[gate === "ok" ? "null_license" : gate],
    };
}

function paperPmcid(paper: ProvenancePaper): PaperProvenance["pmcid"] {
    if (paper.database !== "nih" || paper.idName !== "pmcid") return null;
    const digits = paper.paperId.trim().replace(/^PMC/i, "");
    if (!/^\d+$/.test(digits)) return null;
    return {
        id: `PMC${digits}`,
        href: `https://pmc.ncbi.nlm.nih.gov/articles/PMC${digits}/`,
    };
}

function paperLink(paper: ProvenancePaper): PaperProvenance["link"] {
    const href = resolvableQuoteLink(paper);
    if (!href) return null;
    if (href.startsWith("/")) return { href, label: "Open in reader", external: false };
    const doi = /^https:\/\/doi\.org\/(.+)$/.exec(href);
    if (doi) return { href, label: `doi.org/${doi[1]}`, external: true };
    try {
        return {
            href,
            label: new URL(href).hostname.replace(/^www\./, ""),
            external: true,
        };
    } catch {
        return null;
    }
}

export function paperProvenance(
    papers: ProvenancePaper[],
    report: OpportunityReport | null | undefined,
    brief: string,
): PaperProvenance[] {
    const claims = claimsByPaper(report, brief, papers.length);
    return papers.map((paper) => {
        const source = PAPER_SOURCES[paper.database]?.label ?? paper.database;
        return {
            index: paper.index,
            title: paper.title,
            source,
            foundVia: [...new Set(paper.indexedBy ?? [])].filter(
                (name) => name !== source,
            ),
            pmcid: paperPmcid(paper),
            link: paperLink(paper),
            claims: claims.get(paper.index) ?? [],
            quote: quoteStatus(paper),
        };
    });
}
