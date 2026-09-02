"use client";
import { useEffect, useState } from "react";
import { preload } from "react-dom";
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
    const [videoVariant, setVideoVariant] = useState<"standard" | "hd" | null>(
        null,
    );
    const [videoReady, setVideoReady] = useState(false);

    preload("/dnabg-poster.jpg", { as: "image" });

    useEffect(() => {
        let idleId: number | undefined;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        const connection = (
            navigator as Navigator & {
                connection?: { saveData?: boolean; effectiveType?: string };
            }
        ).connection;
        const saveData = Boolean(connection?.saveData);
        const slowConnection =
            connection?.effectiveType === "2g" ||
            connection?.effectiveType === "slow-2g";

        if (reduceMotion || saveData) {
            return;
        }

        const startVideo = () => {
            if (cancelled) return;
            const minViewport = Math.min(window.innerWidth, window.innerHeight);
            setVideoVariant(
                !slowConnection && minViewport >= 720 ? "hd" : "standard",
            );
        };
        const scheduleAfterLcp = () => {
            const idleWindow = window as Window & {
                requestIdleCallback?: (
                    callback: IdleRequestCallback,
                    options?: IdleRequestOptions,
                ) => number;
                cancelIdleCallback?: (handle: number) => void;
            };
            if (idleWindow.requestIdleCallback) {
                idleId = idleWindow.requestIdleCallback(startVideo, {
                    timeout: 2_000,
                });
            } else {
                fallbackTimer = setTimeout(startVideo, 1_200);
            }
        };

        if (document.readyState === "complete") {
            scheduleAfterLcp();
        } else {
            window.addEventListener("load", scheduleAfterLcp, { once: true });
        }

        return () => {
            cancelled = true;
            window.removeEventListener("load", scheduleAfterLcp);
            if (idleId !== undefined) {
                (
                    window as Window & {
                        cancelIdleCallback?: (handle: number) => void;
                    }
                ).cancelIdleCallback?.(idleId);
            }
            if (fallbackTimer) clearTimeout(fallbackTimer);
        };
    }, []);

    return (
        <div className={styles.home}>
            <div className={styles.poster} aria-hidden />
            {videoVariant ? (
                <video
                    className={videoReady ? styles.videoReady : undefined}
                    poster="/dnabg-poster.jpg"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="none"
                    disablePictureInPicture
                    aria-hidden
                    onPlaying={() => setVideoReady(true)}
                >
                    <source
                        src={
                            videoVariant === "hd"
                                ? "/dnabg-hd.webm"
                                : "/dnabg.webm"
                        }
                        type="video/webm"
                    />
                    <source
                        src={
                            videoVariant === "hd"
                                ? "/dnabg-hd.mp4"
                                : "/dnabg.mp4"
                        }
                        type="video/mp4"
                    />
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
