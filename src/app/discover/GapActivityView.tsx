import type { ReactNode } from "react";
import type {
    GapActivity,
    GapGrantRef,
    GapRegistryResult,
    GapTrialRef,
} from "../api/discover/report-types";
import {
    BROAD_MATCH_GRANTS,
    BROAD_MATCH_TRIALS,
    fiscalYearRangeLabel,
    trialStatusLabel,
} from "../lib/gap-activity";
import styles from "./gap-activity.module.scss";

function formatCheckedDate(checkedAt: string): string {
    const date = new Date(checkedAt);
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
          });
}

function RegistryBlock<T>({
    label,
    result,
    unavailableText,
    emptyText,
    totalText,
    renderItem,
    moreHref,
    broadAbove,
}: {
    label: string;
    result: GapRegistryResult<T>;
    unavailableText: string;
    emptyText: string;
    totalText: (total: number) => string;
    renderItem: (item: T) => ReactNode;
    moreHref?: string;
    broadAbove: number;
}) {
    const broad = result.status === "ok" && result.total > broadAbove;
    return (
        <div className={styles.block}>
            <p className={styles.label}>
                <strong>{label}</strong>
                <span>
                    {result.status === "unavailable"
                        ? unavailableText
                        : result.total === 0
                          ? emptyText
                          : broad
                            ? `${result.total.toLocaleString("en-US")} loose matches, too broad to single out related work.`
                            : totalText(result.total)}
                </span>
            </p>
            {!broad && result.items.length > 0 && (
                <ul className={styles.list}>{result.items.map(renderItem)}</ul>
            )}
            {moreHref && !broad && result.total > result.items.length && (
                <a
                    className={styles.more}
                    href={moreHref}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Search ClinicalTrials.gov
                </a>
            )}
        </div>
    );
}

/** Related NIH grants and active trials for one gap. Keyword matches, not a verdict. */
export function gapActivityCaveat(checkedAt: string): string {
    const checked = formatCheckedDate(checkedAt);
    return `Keyword matches from NIH RePORTER and ClinicalTrials.gov${checked ? `, checked ${checked}` : ""}. Some may be only loosely related, and no match does not mean no one is working on this.`;
}

/** `showCaveat={false}` when the parent shows gapActivityCaveat once for several gaps. */
export default function GapActivityView({
    activity,
    showCaveat = true,
}: {
    activity: GapActivity;
    showCaveat?: boolean;
}) {
    const years = fiscalYearRangeLabel(activity.fiscalYears);
    const trialsSearch = `https://clinicaltrials.gov/search?term=${encodeURIComponent(activity.query)}`;

    return (
        <section className={styles.activity} aria-label="Related grants and trials">
            <RegistryBlock<GapGrantRef>
                label={years ? `NIH grants (${years})` : "NIH grants"}
                broadAbove={BROAD_MATCH_GRANTS}
                result={activity.grants}
                unavailableText="NIH RePORTER could not be reached."
                emptyText="No matching NIH grants found."
                totalText={(total) =>
                    `${total} matching project ${total === 1 ? "record" : "records"}`
                }
                renderItem={(grant) => (
                    <li key={grant.coreProjectNum}>
                        <a href={grant.href} target="_blank" rel="noopener noreferrer">
                            {grant.title}
                        </a>
                        <span className={styles.meta}>
                            {`${grant.coreProjectNum} · FY${grant.fiscalYear}`}
                        </span>
                    </li>
                )}
            />
            <RegistryBlock<GapTrialRef>
                label="Active trials"
                broadAbove={BROAD_MATCH_TRIALS}
                result={activity.trials}
                unavailableText="ClinicalTrials.gov could not be reached."
                emptyText="No matching active trials found."
                totalText={(total) =>
                    `${total} matching ${total === 1 ? "trial" : "trials"}`
                }
                renderItem={(trial) => (
                    <li key={trial.nctId}>
                        <a href={trial.href} target="_blank" rel="noopener noreferrer">
                            {trial.title}
                        </a>
                        <span className={styles.meta}>
                            {[trial.nctId, trial.phase, trialStatusLabel(trial.status)]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                    </li>
                )}
                moreHref={trialsSearch}
            />
            {showCaveat && (
                <p className={styles.caveat}>{gapActivityCaveat(activity.checkedAt)}</p>
            )}
        </section>
    );
}
