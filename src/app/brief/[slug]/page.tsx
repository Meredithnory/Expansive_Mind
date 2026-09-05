import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
    briefPreviewText,
    findSharedBrief,
} from "../../lib/shared-brief";
import ClaimLedgerView from "../../discover/ClaimLedgerView";
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

    const authorLine =
        shared.authors.length > 0
            ? shared.authors.slice(0, 6).join(", ") +
              (shared.authors.length > 6 ? " et al." : "")
            : "";

    return (
        <div className={styles.page}>
            <article className={styles.card}>
                <p className={styles.eyebrow}>
                    {shared.kind === "paper"
                        ? "Paper Summary"
                        : "Topic Synthesis"}
                </p>
                <h1 className={styles.title}>{shared.title}</h1>
                <p className={styles.byline}>
                    {authorLine && <span>{authorLine}</span>}
                    {shared.sourceLabel && (
                        <span>{shared.sourceLabel}</span>
                    )}
                    {shared.publicationDate && (
                        <span>{shared.publicationDate}</span>
                    )}
                </p>

                {shared.claimLedger ? (
                    <div className={styles.ledger}>
                        <ClaimLedgerView ledger={shared.claimLedger} />
                    </div>
                ) : null}

                <div className={styles.brief}>
                    <ReactMarkdown>{shared.brief}</ReactMarkdown>
                </div>

                {shared.canonicalUrl && (
                    <p className={styles.sourceLink}>
                        Original article:{" "}
                        <a
                            href={shared.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {shared.canonicalUrl}
                        </a>
                    </p>
                )}

                {shared.papers.length > 0 && (
                    <section className={styles.sources}>
                        <h2>Papers behind this synthesis</h2>
                        <ol>
                            {shared.papers.map((paper, index) => (
                                <li key={`${paper.href}-${index}`}>
                                    <Link href={paper.href}>
                                        {paper.title}
                                    </Link>
                                    <span className={styles.sourceMeta}>
                                        {[
                                            paper.authors
                                                .slice(0, 3)
                                                .join(", "),
                                            paper.sourceLabel,
                                            paper.date,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                <div className={styles.cta}>
                    <div>
                        <h2>
                            {shared.kind === "paper"
                                ? "Chat with the full paper"
                                : "Run your own discovery"}
                        </h2>
                        <p>
                            Expansive Mind lets you question research papers,
                            surface evidence gaps, and synthesize findings
                            across the literature.
                        </p>
                    </div>
                    <div className={styles.ctaActions}>
                        <Link
                            className={styles.ctaPrimary}
                            href={shared.chatPath}
                        >
                            {shared.kind === "paper"
                                ? "Open this paper"
                                : "Try Discover"}
                        </Link>
                        <Link className={styles.ctaSecondary} href="/signup">
                            Create free account
                        </Link>
                    </div>
                </div>

                <p className={styles.disclaimer}>
                    AI-generated summary shared by an Expansive Mind user.
                    It may contain inaccuracies and is not medical advice.
                </p>
            </article>
        </div>
    );
};

export default SharedBriefPage;
