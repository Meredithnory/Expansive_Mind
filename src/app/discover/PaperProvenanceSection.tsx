import Link from "next/link";
import clsx from "clsx";
import type { ReportReturn } from "../lib/paper-sources";
import {
    claimReaderHref,
    type PaperProvenance,
    type ProvenancePaper,
    type QuoteStatus,
} from "./paper-provenance";
import styles from "./provenance.module.scss";

const STATUS_CLASS: Record<QuoteStatus, string | undefined> = {
    allowed: styles.statusAllowed,
    blocked: styles.statusBlocked,
    unrecorded: styles.statusUnrecorded,
};

/**
 * A paper card's provenance: its PMCID, whether a verbatim quote was allowed
 * (and why not), and the report claims that cite it, each opening the paper
 * at its sentence. Source and "Found via" are the card's own badges.
 */
export default function PaperProvenanceSection({
    paper,
    row,
    reportReturn,
}: {
    paper: Pick<ProvenancePaper, "href" | "index">;
    row: PaperProvenance;
    reportReturn?: ReportReturn;
}) {
    return (
        <div className={styles.section}>
            <dl className={styles.facts}>
                <div>
                    <dt>PMCID</dt>
                    <dd>
                        {row.pmcid ? (
                            <a
                                href={row.pmcid.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.link}
                            >
                                {row.pmcid.id}
                                <span aria-hidden="true"> ↗</span>
                            </a>
                        ) : (
                            <span className={styles.muted}>None recorded</span>
                        )}
                    </dd>
                </div>
                <div>
                    <dt>Quote</dt>
                    <dd>
                        <span className={clsx(styles.status, STATUS_CLASS[row.quote.status])}>
                            {row.quote.label}
                        </span>
                        <span className={styles.sub}>{row.quote.detail}</span>
                    </dd>
                </div>
            </dl>

            {row.claims.length ? (
                <details className={styles.citedIn}>
                    <summary>Cited in the report · {row.claims.length}</summary>
                    <ul>
                        {row.claims.map((claim) => (
                            <li key={`${claim.where}-${claim.text}`}>
                                <span className={styles.where}>{claim.where}</span>
                                <Link
                                    href={claimReaderHref(paper, claim, reportReturn)}
                                    className={styles.claimLink}
                                    title={
                                        claim.evidence
                                            ? "Open the paper at the sentence this cites"
                                            : "Open the paper (no sentence recorded for this citation)"
                                    }
                                >
                                    {claim.text}
                                    <span className={styles.claimCue}>
                                        {claim.evidence ? "Show in paper" : "Open paper"}
                                        <span aria-hidden="true"> →</span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : (
                <p className={styles.muted}>Not cited in the write-up.</p>
            )}
        </div>
    );
}
