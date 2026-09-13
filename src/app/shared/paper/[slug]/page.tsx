"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./shared-paper.module.scss";

interface SharedPaper {
    ownerName: string;
    title: string;
    authors: string[];
    sourceLabel: string;
    canonicalUrl: string;
    publicationDate: string;
    paperPath: string;
    highlights: Array<{
        excerpt: string;
        citation: {
            sectionTitle: string;
            startLine: number;
            endLine: number;
            lines: string[];
        };
        createdAt?: string;
    }>;
    updatedAt: string;
}

export default function SharedPaperPage() {
    const { slug } = useParams<{ slug: string }>();
    const [share, setShare] = useState<SharedPaper | null>(null);
    const [status, setStatus] = useState<
        "loading" | "ready" | "login" | "error"
    >("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch(`/api/paper-shares/${slug}`, {
                    cache: "no-store",
                });
                const data = (await response.json()) as {
                    share?: SharedPaper;
                    error?: string;
                    message?: string;
                };
                if (cancelled) return;
                if (response.status === 401) {
                    setStatus("login");
                    return;
                }
                if (!response.ok || !data.share) {
                    setMessage(
                        data.error ||
                            data.message ||
                            "This shared paper is unavailable.",
                    );
                    setStatus("error");
                    return;
                }
                setShare(data.share);
                setStatus("ready");
            } catch {
                if (!cancelled) {
                    setMessage("This shared paper could not be loaded.");
                    setStatus("error");
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [slug]);

    if (status === "loading") {
        return (
            <main className={styles.state}>
                <p>Opening shared paper…</p>
            </main>
        );
    }

    if (status === "login") {
        return (
            <main className={styles.state}>
                <p className={styles.eyebrow}>Shared with you</p>
                <h1>Sign in to view this paper and its annotations</h1>
                <p>
                    Shared research stays inside Expansive Mind so the
                    researcher&apos;s notes are not public on the web.
                </p>
                <Link
                    className={styles.primaryAction}
                    href={`/login?next=${encodeURIComponent(`/shared/paper/${slug}`)}`}
                >
                    Sign in to continue
                </Link>
            </main>
        );
    }

    if (status === "error" || !share) {
        return (
            <main className={styles.state}>
                <h1>Shared paper unavailable</h1>
                <p>{message}</p>
                <Link className={styles.secondaryAction} href="/searchpaper">
                    Search for papers
                </Link>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <p className={styles.eyebrow}>Shared by {share.ownerName}</p>
                <h1>{share.title}</h1>
                <p className={styles.metadata}>
                    {[share.authors.slice(0, 3).join(", "), share.sourceLabel, share.publicationDate]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                <div className={styles.actions}>
                    <Link className={styles.primaryAction} href={share.paperPath}>
                        Open paper in Expansive Mind
                    </Link>
                    {share.canonicalUrl ? (
                        <a
                            className={styles.secondaryAction}
                            href={share.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View original source
                        </a>
                    ) : null}
                </div>
            </header>

            <section className={styles.annotations}>
                <div className={styles.sectionHeading}>
                    <div>
                        <p className={styles.eyebrow}>Researcher context</p>
                        <h2>
                            {share.highlights.length} annotation
                            {share.highlights.length === 1 ? "" : "s"}
                        </h2>
                    </div>
                    <p>Read-only snapshot</p>
                </div>

                {share.highlights.length ? (
                    <ol className={styles.annotationList}>
                        {share.highlights.map((highlight, index) => (
                            <li
                                key={`${highlight.citation.sectionTitle}-${highlight.citation.startLine}-${index}`}
                                className={styles.annotation}
                            >
                                <Link
                                    className={styles.annotationLocation}
                                    href={`${share.paperPath}?focus=${encodeURIComponent(highlight.excerpt)}`}
                                >
                                    {highlight.citation.sectionTitle} · lines{" "}
                                    {highlight.citation.startLine}
                                    {highlight.citation.endLine ===
                                    highlight.citation.startLine
                                        ? ""
                                        : `–${highlight.citation.endLine}`}
                                    <span>Open in paper →</span>
                                </Link>
                                <blockquote>{highlight.excerpt}</blockquote>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className={styles.emptyAnnotations}>
                        This researcher shared the paper without annotations.
                    </p>
                )}
            </section>
        </main>
    );
}
