"use client";
import { useEffect, useState } from "react";
import styles from "./home.module.scss";
import Link from "next/link";
import { useSession } from "./lib/use-session";

const sequence = [
    {
        index: "01",
        title: "Discover",
        detail: "One question across the open literature.",
    },
    {
        index: "02",
        title: "Read",
        detail: "Every claim opens at its source.",
    },
    {
        index: "03",
        title: "Plan",
        detail: "The gaps become the next experiment.",
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
                <p className={styles.eyebrow}>Research agent</p>
                <h1>Ask the literature.</h1>
                <p className={styles.tagline}>
                    One biomedical question. Cited findings, the conflicts
                    between them, and the gaps still open.
                </p>
                <div className={styles.actions}>
                    <Link href="/discover" className={styles.primaryCta}>
                        Begin a discovery
                        <span aria-hidden="true">→</span>
                    </Link>
                    {isLoggedIn ? (
                        <Link href="/savedpapers" className={styles.secondaryCta}>
                            Research library
                        </Link>
                    ) : loading ? null : (
                        <Link href="/searchpaper" className={styles.secondaryCta}>
                            Search a paper
                        </Link>
                    )}
                </div>
                {isLoggedIn || loading ? null : (
                    <p className={styles.loginHint}>
                        <Link href="/login">Log in</Link>
                    </p>
                )}
            </section>
            <ol className={styles.sequence}>
                {sequence.map((step) => (
                    <li key={step.index}>
                        <span>{step.index}</span>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                    </li>
                ))}
            </ol>
        </div>
    );
}
