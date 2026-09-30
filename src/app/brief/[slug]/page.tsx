import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SafeAssistantMarkdown from "../../components/SafeAssistantMarkdown";
import {
    briefPreviewText,
    findSharedBrief,
    type SharedBrief,
} from "../../lib/shared-brief";
import type { BriefSegment } from "../../lib/brief-view";
import ClaimLedgerView from "../../discover/ClaimLedgerView";
import GapActivityView, {
    gapActivityCaveat,
} from "../../discover/GapActivityView";
import { CONFIDENCE_GUIDE } from "../../discover/report-sections";
import BriefCopyLink from "./BriefCopyLink";
import BriefPaperList from "./BriefPaperList";
import BriefSectionNav, { type BriefNavItem } from "./BriefSectionNav";
import styles from "./brief.module.scss";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const shared = await findSharedBrief(slug);
    if (!shared) {
        return { title: "Brief not found · Expansive Mind" };
    }
    const description = briefPreviewText(shared.brief);
    const artifactLabel =
        shared.kind === "paper" ? "Paper Summary" : "Topic Synthesis";
    return {
        title: `${shared.title} · ${artifactLabel} · Expansive Mind`,
        description,
        openGraph: {
            title: shared.title,
            description,
            type: "article",
        },
        twitter: {
            card: "summary_large_image",
            title: shared.title,
            description,
        },
    };
}

function briefDate(date: Date) {
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return "";
    const sameYear = value.getUTCFullYear() === new Date().getUTCFullYear();
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
        timeZone: "UTC",
    }).format(value);
}

function pluralize(count: number, word: string) {
    return `${count} ${count === 1 ? word : `${word}s`}`;
}

/** Report prose with its "Paper N" chips, each opening the cited sentence. */
function CitedProse({ segments }: { segments: BriefSegment[] }) {
    return (
        <>
            {segments.map((segment, index) =>
                segment.type === "text" ? (
                    <span key={index}>{segment.value}</span>
                ) : (
                    <Link
                        key={index}
                        href={segment.href}
                        className={styles.chip}
                        aria-label={`Open ${segment.label} at the cited passage`}
                    >
                        {segment.label}
                    </Link>
                ),
            )}
        </>
    );
}

function CallToAction({ kind, chatPath }: { kind: SharedBrief["kind"]; chatPath: string }) {
    return (
        <section className={styles.cta} aria-labelledby="brief-cta">
            <div>
                <h2 id="brief-cta">
                    {kind === "paper" ? "Chat with the full paper" : "Run your own discovery"}
                </h2>
                <p>
                    Expansive Mind lets you question research papers, surface
                    evidence gaps, and synthesize findings across the literature.
                </p>
            </div>
            <div className={styles.ctaActions}>
                <Link className={styles.ctaPrimary} href={chatPath}>
                    {kind === "paper" ? "Open this paper" : "Try Discover"}
                </Link>
                <Link className={styles.ctaSecondary} href="/signup?from=brief">
                    Create free account
                </Link>
            </div>
        </section>
    );
}

const DISCLAIMER =
    "AI-generated summary shared by an Expansive Mind user. It may contain inaccuracies and is not medical advice.";

function PaperSummaryBrief({ shared }: { shared: SharedBrief }) {
    const authorLine =
        shared.authors.length > 0
            ? shared.authors.slice(0, 6).join(", ") +
              (shared.authors.length > 6 ? " et al." : "")
            : "";
    return (
        <div className={styles.page}>
            <article className={styles.card}>
                <p className={styles.eyebrow}>Paper Summary</p>
                <h1 className={styles.title}>{shared.title}</h1>
                <p className={styles.byline}>
                    {authorLine && <span>{authorLine}</span>}
                    {shared.sourceLabel && <span>{shared.sourceLabel}</span>}
                    {shared.publicationDate && <span>{shared.publicationDate}</span>}
                </p>
                <div className={styles.brief}>
                    <SafeAssistantMarkdown>{shared.brief}</SafeAssistantMarkdown>
                </div>
                {shared.canonicalUrl && (
                    <p className={styles.sourceLink}>
                        Original article:{" "}
                        <a href={shared.canonicalUrl} target="_blank" rel="noopener noreferrer">
                            {shared.canonicalUrl}
                        </a>
                    </p>
                )}
                <CallToAction kind="paper" chatPath={shared.chatPath} />
                <p className={styles.disclaimer}>{DISCLAIMER}</p>
            </article>
        </div>
    );
}

function TopicBrief({ shared }: { shared: SharedBrief }) {
    const view = shared.view;
    const paperCount = shared.papers.length;
    const date = briefDate(shared.createdAt);
    const eyebrow = ["Topic synthesis", date, pluralize(paperCount, "paper")]
        .filter(Boolean)
        .join(" · ");
    const nav: BriefNavItem[] = [
        { id: "summary", label: "Summary" },
        ...(view && view.gaps.length > 0
            ? [{ id: "gaps", label: "Gaps", count: view.gaps.length }]
            : []),
        ...(shared.claimLedger
            ? [{ id: "ledger", label: "Claim ledger", count: view?.claimCount }]
            : []),
        ...(paperCount > 0 ? [{ id: "papers", label: "Papers", count: paperCount }] : []),
        ...(shared.gapActivity ? [{ id: "activity", label: "Who's on it" }] : []),
    ];

    return (
        <div className={styles.topicPage}>
            <header className={styles.hero}>
                <div className={styles.heroText}>
                    <p className={styles.eyebrow}>{eyebrow}</p>
                    <h1 className={styles.heroTitle}>{shared.title}</h1>
                    <p className={styles.heroLead}>
                        A cited brief. Every claim links to its source.
                    </p>
                    <div className={styles.facts}>
                        <span className={styles.fact}>{pluralize(paperCount, "paper")}</span>
                        {view ? (
                            <>
                                <span className={styles.fact}>{pluralize(view.claimCount, "claim")}</span>
                                <span className={`${styles.fact} ${styles.factGood}`}>
                                    {view.quotedCount} quoted
                                </span>
                            </>
                        ) : null}
                        <span className={styles.factPlain}>Shared by an Expansive Mind user</span>
                    </div>
                </div>
                <div className={styles.heroActions}>
                    <BriefCopyLink />
                    <Link className={styles.ctaPrimary} href="/discover">
                        Try Discover
                    </Link>
                </div>
            </header>

            <div className={styles.layout}>
                <BriefSectionNav items={nav} />
                <main className={styles.main}>
                    <section id="summary" className={styles.section} aria-labelledby="summary-h">
                        <h2 id="summary-h">State of the science</h2>
                        {view ? (
                            <>
                                <p className={styles.summary}>
                                    <CitedProse segments={view.summary} />
                                </p>
                                {view.narrowNotes.map((note) => (
                                    <p key={note.index} className={styles.narrowNote}>
                                        Paper {note.index} studied {note.scope}. Its figures
                                        describe that group, not the question as a whole.
                                    </p>
                                ))}
                            </>
                        ) : (
                            <div className={styles.brief}>
                                <SafeAssistantMarkdown>{shared.brief}</SafeAssistantMarkdown>
                            </div>
                        )}
                    </section>

                    {view && view.gaps.length > 0 ? (
                        <section id="gaps" className={styles.section} aria-labelledby="gaps-h">
                            <h2 id="gaps-h">Gaps in the science · {view.gaps.length}</h2>
                            <div className={styles.gapGrid}>
                                {view.gaps.map((gap) => {
                                    const guide =
                                        CONFIDENCE_GUIDE[gap.confidence] ?? CONFIDENCE_GUIDE.suggested;
                                    return (
                                        <article
                                            key={gap.number}
                                            className={`${styles.gapCard} ${gap.number === 1 ? styles.gapCardLead : ""}`}
                                        >
                                            <div className={styles.gapHead}>
                                                <span className={styles.gapNumber}>Gap {gap.number}</span>
                                                <span
                                                    className={`${styles.confidence} ${gap.confidence === "established" ? styles.confidenceStrong : ""}`}
                                                    title={guide.meaning}
                                                >
                                                    {guide.label}
                                                </span>
                                            </div>
                                            <h3>{gap.title}</h3>
                                            {gap.description.length > 0 ? (
                                                <p>
                                                    <CitedProse segments={gap.description} />
                                                </p>
                                            ) : null}
                                            {gap.papers.length > 0 ? (
                                                <div className={styles.gapPapers}>
                                                    {gap.papers.map((paper) => (
                                                        <Link
                                                            key={paper.index}
                                                            href={paper.href}
                                                            className={styles.chip}
                                                        >
                                                            Paper {paper.index}
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : null}
                                            {gap.activity ? (
                                                <span className={styles.gapActivityLine}>{gap.activity}</span>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    {shared.claimLedger ? (
                        <section id="ledger" className={styles.section} aria-label="Claim ledger">
                            <ClaimLedgerView ledger={shared.claimLedger} briefSlug={shared.slug} />
                        </section>
                    ) : null}

                    {view && view.papers.length > 0 ? (
                        <section id="papers" className={styles.section} aria-labelledby="papers-h">
                            <h2 id="papers-h">Papers behind this synthesis</h2>
                            <BriefPaperList papers={view.papers} />
                        </section>
                    ) : null}

                    {shared.gapActivity ? (
                        <section id="activity" className={styles.section} aria-labelledby="activity-h">
                            <h2 id="activity-h">Who else is working on these gaps</h2>
                            <div className={styles.activityGrid}>
                                {shared.gapActivity.map((item) => (
                                    <div key={item.gapNumber} className={styles.activityCard}>
                                        <h3>
                                            <span>Gap {item.gapNumber}</span>
                                            {item.title}
                                        </h3>
                                        <GapActivityView activity={item.activity} showCaveat={false} />
                                    </div>
                                ))}
                            </div>
                            <p className={styles.caveat}>
                                {gapActivityCaveat(shared.gapActivity[0].activity.checkedAt)}
                            </p>
                        </section>
                    ) : null}

                    <CallToAction kind="discovery" chatPath={shared.chatPath} />
                    <p className={styles.disclaimer}>{DISCLAIMER}</p>
                </main>
            </div>
        </div>
    );
}

const SharedBriefPage = async ({
    params,
}: {
    params: Promise<{ slug: string }>;
}) => {
    const { slug } = await params;
    const shared = await findSharedBrief(slug);
    if (!shared) {
        notFound();
    }
    return shared.kind === "paper" ? (
        <PaperSummaryBrief shared={shared} />
    ) : (
        <TopicBrief shared={shared} />
    );
};

export default SharedBriefPage;
