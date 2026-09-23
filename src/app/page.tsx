"use client";
import { useEffect, useState } from "react";
import styles from "./home.module.scss";
import Link from "next/link";
import { useSession } from "./lib/use-session";

const paths = [
    {
        index: "01",
        title: "A question that won't settle",
        detail: "One biomedical question is enough, even if it's still rough. You'll see what the papers report and where they don't agree.",
        href: "/discover",
        action: "Ask it",
    },
    {
        index: "02",
        title: "A paper you need to understand",
        detail: "Open the article and ask about a passage. The reply stays inside that text, and you can jump back to the lines.",
        href: "/searchpaper",
        action: "Open a paper",
    },
    {
        index: "03",
        title: "Work you want to come back to",
        detail: "Save the papers and the thread. The gap you noticed can wait until you're ready for the next experiment.",
        href: "/savedpapers",
        action: "Your library",
    },
];

export default function Home() {
    const { isLoggedIn, loading } = useSession();
    const [showVideo, setShowVideo] = useState(true);

    useEffect(() => {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reduceMotion) setShowVideo(false);
    }, []);

    return (
        <div className={styles.home}>
            <link
                rel="preload"
                as="image"
                href="/dnabg-poster.jpg"
                fetchPriority="high"
            />
            {showVideo ? (
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/dnabg-poster.jpg"
                    preload="auto"
                >
                    <source src="/dnabg-hd.webm" type="video/webm" />
                    <source src="/dnabg-hd.mp4" type="video/mp4" />
                </video>
            ) : null}
            <div className={styles.scrim} aria-hidden="true" />
            <section className={styles.hero}>
                <p className={styles.eyebrow}>A rough question is welcome</p>
                <h1>Ask the literature.</h1>
                <p className={styles.tagline}>
                    Bring the biomedical question you&apos;re actually holding.
                    A half-formed one is welcome. You&apos;ll see what the open
                    papers report, where they conflict, and what they still
                    leave open. Every finding stays tied to its source.
                </p>
                <div className={styles.actions}>
                    <Link href="/discover" className={styles.primaryCta}>
                        Start with your question
                        <span aria-hidden="true">→</span>
                    </Link>
                    {isLoggedIn ? (
                        <Link href="/savedpapers" className={styles.secondaryCta}>
                            Pick up your library
                        </Link>
                    ) : loading ? null : (
                        <Link href="/searchpaper" className={styles.secondaryCta}>
                            I already have a paper
                        </Link>
                    )}
                </div>
                {loading ? null : isLoggedIn ? (
                    <p className={styles.loginHint}>
                        Your saved papers and conversations are here when you
                        want to continue.
                    </p>
                ) : (
                    <p className={styles.loginHint}>
                        Reading is open to anyone. A free account lets you save
                        papers and ask about the text.{" "}
                        <Link href="/login">Log in</Link>
                        {" · "}
                        <Link href="/signup">Create an account</Link>
                    </p>
                )}
            </section>
            <ol className={styles.sequence}>
                {paths.map((path) => (
                    <li key={path.index}>
                        <Link href={path.href}>
                            <span>{path.index}</span>
                            <strong>{path.title}</strong>
                            <p>{path.detail}</p>
                            <em>{path.action}</em>
                        </Link>
                    </li>
                ))}
            </ol>
        </div>
    );
}
