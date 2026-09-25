import Link from "next/link";
import clsx from "clsx";
import type { ClaimLedger, ClaimLedgerRow } from "../api/discover/report-types";
import { isClaimLedgerRowComplete } from "../api/discover/claim-ledger";
import styles from "./claim-ledger.module.scss";

type CitePaper = (index: number, trigger?: HTMLElement | null) => void;

function sourceLabel(row: ClaimLedgerRow): string {
    if (row.doi) return `DOI ${row.doi}`;
    if (row.paperIndex) return `Paper ${row.paperIndex}`;
    return "No paper linked";
}

function LedgerRow({
    row,
    active,
    onCitePaper,
}: {
    row: ClaimLedgerRow;
    active: boolean;
    onCitePaper?: CitePaper;
}) {
    const complete = isClaimLedgerRowComplete(row);
    const className = clsx(styles.row, {
        [styles.rowActive]: active,
        [styles.rowIncomplete]: !complete,
    });
    const body = (
        <>
            <div className={styles.rowHeader}>
                <span className={styles.kind}>{row.kind}</span>
                {row.confidence ? (
                    <span className={styles.confidence}>{row.confidence}</span>
                ) : null}
                <span className={styles.source}>{sourceLabel(row)}</span>
            </div>
            <p className={styles.claim}>{row.claim}</p>
            {row.quote ? (
                <blockquote className={styles.quote}>{row.quote}</blockquote>
            ) : (
                <p className={styles.missing}>Needs a source excerpt</p>
            )}
        </>
    );

    if (onCitePaper && row.paperIndex) {
        return (
            <button
                type="button"
                className={className}
                aria-pressed={active}
                onClick={(event) =>
                    onCitePaper(row.paperIndex as number, event.currentTarget)
                }
            >
                {body}
            </button>
        );
    }

    if (row.href) {
        return (
            <Link href={row.href} className={className}>
                {body}
            </Link>
        );
    }

    return <div className={className}>{body}</div>;
}

export default function ClaimLedgerView({
    ledger,
    activePaperIndex,
    onCitePaper,
}: {
    ledger: ClaimLedger;
    activePaperIndex?: number | null;
    onCitePaper?: CitePaper;
}) {
    const completeCount = ledger.rows.filter(isClaimLedgerRowComplete).length;
    const total = ledger.rows.length;

    return (
        <section className={styles.ledger} id="claim-ledger" aria-labelledby="claim-ledger-heading">
            <div className={styles.heading}>
                <h3 id="claim-ledger-heading">Claim ledger</h3>
                <span>
                    {total === 0
                        ? "No sourced claims"
                        : `${completeCount} of ${total} sourced`}
                </span>
            </div>
            {total === 0 ? (
                <p className={styles.empty}>
                    Share stays locked until this brief has sourced claims.
                </p>
            ) : (
                <ol className={styles.list}>
                    {ledger.rows.map((row) => (
                        <li key={row.id}>
                            <LedgerRow
                                row={row}
                                active={
                                    Boolean(row.paperIndex) &&
                                    activePaperIndex === row.paperIndex
                                }
                                onCitePaper={onCitePaper}
                            />
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
