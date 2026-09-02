"use client";
import { useEffect, useState } from "react";
import styles from "./home.module.scss";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "./lib/use-session";

const features = [
    { label: "Discover", detail: "Synthesize evidence across papers" },
    { label: "Read", detail: "Open every claim at its source" },
    { label: "Plan", detail: "Turn evidence gaps into next steps" },
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
            {showVideo ? (
                <video autoPlay muted loop playsInline>
                    <source src="/dnabg.mov" type="video/quicktime" />
                    <source src="/dnabg.mp4" type="video/mp4" />
                    <source src="/dnabg.webm" type="video/webm" />
                </video>
            ) : null}
            <div className={styles.hero}>
                <p className={styles.eyebrow}>Evidence, made actionable</p>
                <div className={styles.brand}>
                    <h1>Expansive Mind</h1>
                    <Image
                        src="/brainlogo.svg"
                        alt=""
                        width={72}
                        height={72}
                        priority
                    />
                </div>
                <p className={styles.tagline}>
                    Ask a research question, understand the evidence across
                    papers, then read every source behind the synthesis.
                </p>
                <div className={styles.actions}>
                    <Link href="/discover" className={styles.primaryCta}>
                        Discover a question
                    </Link>
                    {isLoggedIn ? (
                        <Link href="/savedpapers" className={styles.secondaryCta}>
                            Open Research Library
                        </Link>
                    ) : loading ? null : (
                        <Link href="/searchpaper" className={styles.secondaryCta}>
                            Search for a paper
                        </Link>
                    )}
                </div>
                {isLoggedIn ? (
                    <p className={styles.loginHint}>
                        <Link href="/searchpaper">Quick paper search</Link>
                        {" · "}
                        <Link href="/pricing">View your plan</Link>
                    </p>
                ) : loading ? null : (
                    <p className={styles.loginHint}>
                        Already have an account? <Link href="/login">Log in</Link>
                    </p>
                )}
                <ul className={styles.features}>
                    {features.map((feature) => (
                        <li key={feature.label}>
                            <span className={styles.featureLabel}>
                                {feature.label}
                            </span>
                            <span className={styles.featureDetail}>
                                {feature.detail}
                            </span>
                        </li>
                    ))}
                </ul>
                <Link href="/about" className={styles.aboutLink}>
                    See how it works
                </Link>
            </div>
        </div>
    );
}
