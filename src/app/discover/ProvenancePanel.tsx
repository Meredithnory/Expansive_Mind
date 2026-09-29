"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { OpportunityReport } from "../api/discover/report-types";
import {
    paperProvenance,
    type ProvenancePaper,
    type QuoteStatus,
} from "./paper-provenance";
import styles from "./provenance.module.scss";

type OpenPaper = (index: number, trigger?: HTMLElement | null) => void;

const STATUS_CLASS: Record<QuoteStatus, string | undefined> = {
    allowed: styles.statusAllowed,
    blocked: styles.statusBlocked,
    unrecorded: styles.statusUnrecorded,
};

function ExternalLink({ href, children }: { href: string; children: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={children}
            className={styles.link}
        >
            {children}
            <span aria-hidden="true"> ↗</span>
        </a>
    );
}

/** Per paper: where it came from, how to open it, what cites it, and whether it may be quoted. */
export default function ProvenancePanel({
    papers,
    report,
    brief,
    activePaperIndex,
    onOpenPaper,
}: {
    papers: ProvenancePaper[];
    report?: OpportunityReport | null;
    brief: string;
    activePaperIndex?: number | null;
    onOpenPaper?: OpenPaper;
}) {
    const rows = useMemo(
        () => paperProvenance(papers, report, brief),
        [papers, report, brief],
    );
    const allowed = rows.filter((row) => row.quote.status === "allowed").length;
    const blocked = rows.filter((row) => row.quote.status === "blocked").length;
    const unrecorded = rows.length - allowed - blocked;

    return (
        <section className={styles.panel} aria-labelledby="provenance-heading">
            <div className={styles.heading}>
                <div>
                    <p className={styles.kicker}>Sources</p>
                    <h2 id="provenance-heading" className={styles.title}>
                        Provenance
                    </h2>
                    <p className={styles.lead}>
                        Verbatim quotes need a CC0, CC BY, CC BY-SA, or CC BY-ND
                        license and are capped at 600 characters. Unknown
                        licenses are not quoted.
                    </p>
                </div>
                <p className={styles.summary}>
                    {[
                        `${rows.length} ${rows.length === 1 ? "paper" : "papers"}`,
                        `${allowed} allowed`,
                        `${blocked} blocked`,
                        unrecorded ? `${unrecorded} not recorded` : "",
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            </div>

            <ol className={styles.list}>
                {rows.map((row) => (
                    <li
                        key={row.index}
                        id={`provenance-paper-${row.index}`}
                        className={clsx(styles.row, {
                            [styles.rowActive]: activePaperIndex === row.index,
                        })}
                    >
                        <div className={styles.rowHead}>
                            <span className={styles.number}>
                                {String(row.index).padStart(2, "0")}
                            </span>
                            <h3 className={styles.paperTitle}>
                                {onOpenPaper ? (
                                    <button
                                        type="button"
                                        aria-haspopup="dialog"
                                        onClick={(event) =>
                                            onOpenPaper(row.index, event.currentTarget)
                                        }
                                    >
                                        {row.title}
                                    </button>
                                ) : (
                                    row.title
                                )}
                            </h3>
                        </div>

                        <dl className={styles.facts}>
                            <div>
                                <dt>Source</dt>
                                <dd>
                                    {row.source}
                                    {row.foundVia.length ? (
                                        <span className={styles.sub}>
                                            Found via {row.foundVia.join(" · ")}
                                        </span>
                                    ) : null}
                                </dd>
                            </div>
                            <div>
                                <dt>PMCID</dt>
                                <dd>
                                    {row.pmcid ? (
                                        <ExternalLink href={row.pmcid.href}>
                                            {row.pmcid.id}
                                        </ExternalLink>
                                    ) : (
                                        <span className={styles.muted}>None recorded</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Link</dt>
                                <dd>
                                    {row.link?.external ? (
                                        <ExternalLink href={row.link.href}>
                                            {row.link.label}
                                        </ExternalLink>
                                    ) : row.link ? (
                                        <a href={row.link.href} className={styles.link}>
                                            {row.link.label}
                                        </a>
                                    ) : (
                                        <span className={styles.muted}>None</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Quote</dt>
                                <dd>
                                    <span
                                        className={clsx(
                                            styles.status,
                                            STATUS_CLASS[row.quote.status],
                                        )}
                                    >
                                        {row.quote.label}
                                    </span>
                                    <span className={styles.sub}>{row.quote.detail}</span>
                                </dd>
                            </div>
                        </dl>

                        <div className={styles.claims}>
                            <p className={styles.claimsLabel}>
                                Cited in
                                {row.claims.length ? ` · ${row.claims.length}` : ""}
                            </p>
                            {row.claims.length ? (
                                <ul>
                                    {row.claims.map((claim) => (
                                        <li key={`${claim.where}-${claim.text}`}>
                                            <span className={styles.where}>{claim.where}</span>
                                            <span>{claim.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.muted}>Not cited in the write-up.</p>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
