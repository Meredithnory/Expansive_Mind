import type {
    DiscoverPaperCard,
    OpportunityReport,
    PaperEvidence,
    PaperExtraction,
} from "../api/discover/report-types";
import { normalizeLicense } from "../lib/content-access-policy";
import { evidencePaper, splitCitedText } from "../lib/cited-text";
import { citedEvidence, evidenceFocusHref } from "../lib/paper-evidence";
import {
    BRIEF_CLAIM_MAX_CHARS,
    PAPER_SOURCES,
    withReportOrigin,
    type ReportReturn,
} from "../lib/paper-sources";
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
    /** The write-up's own words, citations removed, shortened for the list. */
    text: string;
    /** The claim in full: what the reader shows as "Cited in your report for". */
    context: string;
    /** The item's words to match against the paper's evidence when no id was recorded. */
    match: string;
    /** The evidence the report recorded for this citation, when it did. */
    evidenceId: string | null;
    /** The gap it belongs to, for the reader's way back. */
    gapNumber?: number;
}

/** A citing claim and the sentence of the paper it relies on, when known. */
export interface ProvenanceClaimLink extends ProvenanceClaim {
    evidence: PaperEvidence | null;
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
    claims: ProvenanceClaimLink[];
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
type CitationRefs = Record<string, Array<string | null>> | undefined;

/** The evidence a chip for `paper` recorded, among a field's chips. */
function refFor(ids: Array<string | null>, cited: number[], paper: number) {
    for (let at = 0; at < cited.length; at += 1) {
        if (cited[at] === paper && ids[at]) return ids[at];
    }
    return null;
}

function addProse(
    add: ClaimSink,
    text: string,
    where: string,
    paperCount: number,
    refs?: Array<string | null>,
) {
    // Evidence ids are recorded per chip across the whole field, in order.
    let chip = 0;
    for (const paragraph of splitParagraphs(text)) {
        for (const sentence of paragraph.split(SENTENCE_BREAK)) {
            const cited = citedIn(sentence, paperCount);
            const ids = cited.map(() => refs?.[chip++] ?? null);
            if (cited.length === 0) continue;
            const plain = plainText(sentence, paperCount);
            if (!plain) continue;
            for (const paper of new Set(cited)) {
                add(paper, {
                    where,
                    text: clip(plain),
                    context: plain,
                    match: plain,
                    evidenceId: refFor(ids, cited, paper),
                });
            }
        }
    }
}

function addItem(
    add: ClaimSink,
    item: {
        where: string;
        /** Citation-evidence key prefix, e.g. "gaps.0". */
        key: string;
        title: string;
        fields: Record<string, string | undefined>;
        citations?: number[];
        gapNumber?: number;
    },
    paperCount: number,
    refs: CitationRefs,
) {
    const cited = new Set(
        (item.citations ?? []).filter(
            (index) => Number.isInteger(index) && index >= 1 && index <= paperCount,
        ),
    );
    const texts = [item.title, ...Object.values(item.fields)];
    for (const field of texts) {
        for (const index of citedIn(field, paperCount)) cited.add(index);
    }
    const title = plainText(item.title, paperCount);
    if (!title) return;
    // The item's text fields first (where chips usually sit), then its title.
    const keys = [...Object.keys(item.fields), "title"].map((name) => `${item.key}.${name}`);
    for (const paper of cited) {
        const evidenceId =
            keys
                .flatMap((key) => refs?.[key] ?? [])
                .find((id): id is string => Boolean(id) && evidencePaper(id as string) === paper) ?? null;
        add(paper, {
            where: item.where,
            text: clip(title),
            context: title,
            match: plainText(texts.filter(Boolean).join(" "), paperCount),
            evidenceId,
            ...(item.gapNumber ? { gapNumber: item.gapNumber } : {}),
        });
    }
}

/**
 * Every place in the write-up that cites each paper, in reading order: an
 * explicit citation list or a "Paper N" chip in the item's text. A problem
 * that only points at a gap does not cite that gap's papers itself. Each
 * claim keeps the evidence id the report recorded for that citation.
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
    const refs = sections.citationEvidence;
    addProse(add, sections.stateOfScience, "State of the science", paperCount, refs?.stateOfScience);
    sections.gaps.forEach((gap, index) =>
        addItem(
            add,
            {
                where: `Gap ${index + 1}`,
                key: `gaps.${index}`,
                title: gap.title,
                fields: {
                    description: gap.description,
                    whyItMatters: gap.whyItMatters,
                    scopeNote: gap.scopeNote,
                },
                citations: gap.citations,
                gapNumber: index + 1,
            },
            paperCount,
            refs,
        ),
    );
    sections.problems.forEach((problem, index) =>
        addItem(
            add,
            {
                where: `Problem ${index + 1}`,
                key: `problems.${index}`,
                title: problem.title,
                fields: { description: problem.description },
            },
            paperCount,
            refs,
        ),
    );
    sections.projectSeeds.forEach((seed, index) =>
        addItem(
            add,
            {
                where: `Experiment ${index + 1}`,
                key: `projectSeeds.${index}`,
                title: seed.title,
                fields: { oneLiner: seed.oneLiner },
            },
            paperCount,
            refs,
        ),
    );
    sections.venturePotential.forEach((item, index) =>
        addItem(
            add,
            {
                where: `Translation ${index + 1}`,
                key: `venturePotential.${index}`,
                title: item.title,
                fields: {
                    thesis: item.thesis,
                    feasibilitySignals: item.feasibilitySignals,
                    risks: item.risks,
                },
                citations: item.citations,
            },
            paperCount,
            refs,
        ),
    );
    sections.couldNotVerify.forEach((item, index) =>
        addProse(add, item, "What we could not verify", paperCount, refs?.[`couldNotVerify.${index}`]),
    );
    return claims;
}

/**
 * Opens the paper in the reader at the sentence the claim relies on,
 * highlighted, with chat hidden (`chat=off`) and the claim shown above the
 * paper. The sentence travels as its fingerprint when the paper can't be
 * quoted, so no paper text is added to the link.
 */
export function claimReaderHref(
    paper: Pick<ProvenancePaper, "href" | "index">,
    claim: Pick<ProvenanceClaimLink, "context" | "evidence" | "gapNumber">,
    returnTo?: ReportReturn,
): string {
    const href = withReportOrigin(
        evidenceFocusHref(paper.href, claim.evidence),
        paper.index,
        claim.gapNumber ?? null,
        returnTo,
    );
    if (!href.startsWith("/paperchatbot/")) return href;
    const [path, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    params.set("chat", "off");
    params.set("claim", claim.context.slice(0, BRIEF_CLAIM_MAX_CHARS));
    return `${path}?${params}`;
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
    extractions: Array<Pick<PaperExtraction, "index" | "evidence">> = [],
): PaperProvenance[] {
    const claims = claimsByPaper(report, brief, papers.length);
    return papers.map((paper) => {
        const source = PAPER_SOURCES[paper.database]?.label ?? paper.database;
        const evidence = extractions.find((item) => item.index === paper.index)?.evidence;
        return {
            index: paper.index,
            title: paper.title,
            source,
            foundVia: [...new Set(paper.indexedBy ?? [])].filter(
                (name) => name !== source,
            ),
            pmcid: paperPmcid(paper),
            link: paperLink(paper),
            // The recorded evidence, else the paper's evidence that clearly
            // matches the claim's words; never a guess.
            claims: (claims.get(paper.index) ?? []).map((claim) => ({
                ...claim,
                evidence: citedEvidence(evidence, paper.index, {
                    evidenceId: claim.evidenceId,
                    context: claim.match,
                }),
            })),
            quote: quoteStatus(paper),
        };
    });
}
