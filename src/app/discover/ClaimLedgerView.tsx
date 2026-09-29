"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type {
    ClaimLedger,
    ClaimLedgerKind,
    ClaimLedgerRow,
    ClaimLedgerSource,
} from "../api/discover/report-types";
import { isClaimLedgerRowComplete } from "../api/discover/claim-ledger";
import { normalizeLicense } from "../lib/content-access-policy";
import type { CiteContext } from "../lib/paper-evidence";
import { buildPaperFocusHref, withBriefOrigin } from "../lib/paper-sources";
import { visiblePaperQuote } from "../lib/quote-eligibility";
import { CONFIDENCE_GUIDE } from "./report-sections";
import styles from "./claim-ledger.module.scss";

type CitePaper = (
    index: number,
    trigger?: HTMLElement | null,
    cite?: CiteContext,
) => void;

type Filter = "all" | "quoted" | "link";

const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All claims" },
    { id: "quoted", label: "Quoted" },
    { id: "link", label: "Link only" },
];

const KIND_LABEL: Record<ClaimLedgerKind, string> = {
    gap: "Gap",
    problem: "Problem",
    venture: "Translation note",
};

/** "gap-2" → "Gap 2". */
function rowLabel(row: ClaimLedgerRow) {
    const ordinal = row.id.split("-")[1];
    return ordinal ? `${KIND_LABEL[row.kind]} ${ordinal}` : KIND_LABEL[row.kind];
}

function paperCount(row: ClaimLedgerRow): string {
    const n = row.sources.length;
    if (n === 0) return "No paper linked";
    return n === 1 ? "1 paper" : `${n} papers`;
}

function shownQuote(source: ClaimLedgerSource) {
    return visiblePaperQuote({
        quote: source.quote,
        title: source.title,
        doi: source.doi,
        href: source.href,
        licenseUrl: source.licenseUrl,
    });
}

/**
 * Each passage prints once. Maps "rowId:paperIndex" of every later source
 * that repeats a passage to the row that quoted it first.
 */
function repeatedPassages(ledger: ClaimLedger): Map<string, ClaimLedgerRow> {
    const firstRow = new Map<string, ClaimLedgerRow>();
    const repeats = new Map<string, ClaimLedgerRow>();
    for (const row of ledger.rows) {
        for (const source of row.sources) {
            const shown = shownQuote(source);
            if (!shown) continue;
            const key = `${source.paperIndex}:${shown.quote.replace(/\s+/g, " ").trim().toLowerCase()}`;
            const first = firstRow.get(key);
            if (first) repeats.set(`${row.id}:${source.paperIndex}`, first);
            else firstRow.set(key, row);
        }
    }
    return repeats;
}

function licenseName(url?: string) {
    return url ? normalizeLicense(null, url).licenseName : null;
}

function readerHref(
    source: ClaimLedgerSource,
    quote: string | undefined,
    claim: string,
    briefSlug?: string,
) {
    if (!source.href) return null;
    const href = quote
        ? buildPaperFocusHref(source.href, quote, { method: false })
        : source.href;
    return briefSlug ? withBriefOrigin(href, briefSlug, claim) : href;
}

function Source({
    row,
    source,
    repeatOf,
    active,
    briefSlug,
    onCitePaper,
}: {
    row: ClaimLedgerRow;
    source: ClaimLedgerSource;
    repeatOf?: ClaimLedgerRow;
    active: boolean;
    briefSlug?: string;
    onCitePaper?: CitePaper;
}) {
    const shown = shownQuote(source);
    const quoted = Boolean(shown) && !repeatOf;
    const href = readerHref(source, shown?.quote, row.claim, briefSlug);
    const paperLabel = `Paper ${source.paperIndex}`;
    const openLabel = `Open ${paperLabel}${shown ? " at this passage" : ""}`;
    const title = shown?.title ?? source.title;

    const pill = onCitePaper ? (
        <button
            type="button"
            className={styles.cite}
            aria-pressed={active}
            aria-label={openLabel}
            onClick={(event) =>
                onCitePaper(source.paperIndex, event.currentTarget, {
                    context: row.claim,
                })
            }
        >
            {paperLabel}
        </button>
    ) : href ? (
        <Link href={href} className={styles.cite} aria-label={openLabel}>
            {paperLabel}
        </Link>
    ) : (
        <span className={styles.citeText}>{paperLabel}</span>
    );

    // A quote always travels with its paper's title and a link to it.
    let titleNode: React.ReactNode = null;
    if (quoted && shown) {
        const external = /^https?:\/\//i.test(shown.link);
        titleNode = (
            <a
                href={shown.link}
                className={styles.sourceTitle}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
                {shown.title}
            </a>
        );
    } else if (title && href && !onCitePaper) {
        titleNode = (
            <Link href={href} className={styles.sourceTitle}>
                {title}
            </Link>
        );
    } else if (title) {
        titleNode = <span className={styles.sourceTitleText}>{title}</span>;
    }

    const license = quoted ? licenseName(source.licenseUrl) : null;

    return (
        <li className={clsx(styles.sourceItem, { [styles.sourceActive]: active })}>
            <figure className={styles.sourceFigure}>
                {quoted && shown ? (
                    <blockquote className={styles.quote}>{shown.quote}</blockquote>
                ) : null}
                <figcaption className={styles.sourceMeta}>
                    {pill}
                    {titleNode}
                    {license ? <span className={styles.license}>{license}</span> : null}
                    {href && !onCitePaper ? (
                        <Link href={href} className={styles.open}>
                            {shown ? "Open at this passage →" : "Open paper →"}
                        </Link>
                    ) : null}
                </figcaption>
            </figure>
            {source.scope ? (
                <p className={styles.scope}>
                    This paper studied {source.scope}, a narrower group than the question.
                </p>
            ) : null}
            {repeatOf ? (
                <a href={`#ledger-${repeatOf.id}`} className={styles.note}>
                    Same passage as {rowLabel(repeatOf)} ↑
                </a>
            ) : !shown ? (
                <p className={styles.note}>
                    Not quoted here. Open the paper to read the passage.
                </p>
            ) : null}
        </li>
    );
}

function LedgerRow({
    row,
    activePaperIndex,
    repeats,
    briefSlug,
    onCitePaper,
}: {
    row: ClaimLedgerRow;
    activePaperIndex?: number | null;
    repeats: Map<string, ClaimLedgerRow>;
    briefSlug?: string;
    onCitePaper?: CitePaper;
}) {
    const complete = isClaimLedgerRowComplete(row);
    const active = row.sources.some(
        (source) => source.paperIndex === activePaperIndex,
    );
    return (
        <article
            id={`ledger-${row.id}`}
            className={clsx(styles.row, {
                [styles.rowActive]: active,
                [styles.rowIncomplete]: !complete,
            })}
        >
            <div className={styles.rowHeader}>
                <span className={styles.kind}>{rowLabel(row)}</span>
                {row.confidence ? (
                    <span
                        className={styles.confidence}
                        title={CONFIDENCE_GUIDE[row.confidence]?.meaning}
                    >
                        {CONFIDENCE_GUIDE[row.confidence]?.label ?? row.confidence}
                    </span>
                ) : null}
                <span className={styles.source}>{paperCount(row)}</span>
            </div>
            <p className={styles.claim}>{row.claim}</p>
            {row.sources.length > 0 ? (
                <ul className={styles.sources}>
                    {row.sources.map((source) => (
                        <Source
                            key={source.paperIndex}
                            row={row}
                            source={source}
                            repeatOf={repeats.get(`${row.id}:${source.paperIndex}`)}
                            active={source.paperIndex === activePaperIndex}
                            briefSlug={briefSlug}
                            onCitePaper={onCitePaper}
                        />
                    ))}
                </ul>
            ) : (
                <p className={styles.missing}>
                    No paper in this run is cited for this claim.
                </p>
            )}
        </article>
    );
}

export default function ClaimLedgerView({
    ledger,
    activePaperIndex,
    onCitePaper,
    briefSlug,
}: {
    ledger: ClaimLedger;
    activePaperIndex?: number | null;
    onCitePaper?: CitePaper;
    /** On a shared brief: reader links carry "Back to the brief". */
    briefSlug?: string;
}) {
    const [filter, setFilter] = useState<Filter>("all");
    const completeCount = ledger.rows.filter(isClaimLedgerRowComplete).length;
    const total = ledger.rows.length;
    const repeats = repeatedPassages(ledger);
    const rows = ledger.rows.filter((row) => {
        if (filter === "all") return true;
        const quoted = isClaimLedgerRowComplete(row);
        return filter === "quoted" ? quoted : !quoted;
    });

    return (
        <section className={styles.ledger} id="claim-ledger" aria-labelledby="claim-ledger-heading">
            <div className={styles.heading}>
                <div className={styles.headingText}>
                    <h3 id="claim-ledger-heading">Claim ledger</h3>
                    <p>
                        Each claim once, with every paper behind it. A passage is
                        quoted only where the paper&apos;s license allows it.
                    </p>
                </div>
                {total > 0 ? (
                    <div className={styles.headingSide}>
                        <span className={styles.count}>
                            {completeCount} of {total} claims quoted
                        </span>
                        <div role="radiogroup" aria-label="Show claims" className={styles.filters}>
                            {FILTERS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={filter === item.id}
                                    className={styles.filter}
                                    onClick={() => setFilter(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
            {total === 0 ? (
                <p className={styles.empty}>This brief has no sourced claims yet.</p>
            ) : rows.length === 0 ? (
                <p className={styles.empty}>
                    {filter === "quoted"
                        ? "No claim here has a quotable passage."
                        : "Every claim here has a quoted passage."}
                </p>
            ) : (
                <ol className={styles.list}>
                    {rows.map((row) => (
                        <li key={row.id}>
                            <LedgerRow
                                row={row}
                                activePaperIndex={activePaperIndex}
                                repeats={repeats}
                                briefSlug={briefSlug}
                                onCitePaper={onCitePaper}
                            />
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
