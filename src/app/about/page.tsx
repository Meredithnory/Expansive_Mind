"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./about.module.scss";
import Image from "next/image";
import Link from "next/link";
import PlaceholderLine from "../components/PlaceholderLine";
import { useSession } from "../lib/use-session";

const AUTO_ADVANCE_MS = 5000;
const RESUME_AFTER_INTERACTION_MS = 6000;

const steps = [
    {
        number: "1",
        title: "Discover",
        description:
            "Ask one question. See what the open papers report, where they conflict, and what they leave open.",
    },
    {
        number: "2",
        title: "Search",
        description:
            "Start from a paper instead. Look it up across the indexes and open the one you mean.",
    },
    {
        number: "3",
        title: "Read",
        description:
            "Ask about a passage. The reply stays inside that paper, and you can jump back to the lines.",
    },
    {
        number: "4",
        title: "Keep",
        description:
            "Save the papers and the thread, or turn a gap into the next experiment.",
    },
];

const notes = [
    {
        title: "Fetched live",
        body: "Article text is pulled from the source when you need it. We don't store article bodies in our database. Publisher terms may still apply.",
    },
    {
        title: "Private-by-default AI",
        body: "Your question, relevant excerpts, and a little recent chat go to OpenRouter with Zero Data Retention. They may keep metadata like model, timing, and token counts.",
    },
    {
        title: "Light records",
        body: "Saved papers store identifiers, not the article. Chat messages stay until you delete them. Answers can be wrong, and they're not medical advice.",
    },
    {
        title: "Independent",
        body: "Expansive Mind isn't affiliated with or endorsed by NIH, NCBI, Springer Nature, Google Scholar, SerpApi, OpenRouter, or the article publishers.",
    },
];

const StepPreview = ({ index }: { index: number }) => {
    if (index === 0) {
        return (
            <>
                <div className={styles.mockSearchBar}>
                    <Image
                        src="/pinksearchicon.svg"
                        alt=""
                        width={20}
                        height={20}
                        aria-hidden
                    />
                    <span>why CAR-T fails in solid tumors</span>
                </div>
                <div className={styles.mockResults}>
                    <PlaceholderLine width="92" />
                    <PlaceholderLine width="78" />
                    <PlaceholderLine width="65" />
                </div>
            </>
        );
    }

    if (index === 1) {
        return (
            <div className={styles.mockHits}>
                <div className={styles.mockPaper}>
                    <p className={styles.mockPaperTitle}>
                        CAR-T persistence in solid tumors
                    </p>
                    <p className={styles.mockPaperMeta}>NIH PMC · Full text</p>
                </div>
                <div className={styles.mockPaper}>
                    <p className={styles.mockPaperTitle}>
                        Barriers to CAR-T efficacy
                    </p>
                    <p className={styles.mockPaperMeta}>
                        Springer Nature · Open access
                    </p>
                </div>
            </div>
        );
    }

    if (index === 2) {
        return (
            <div className={styles.mockChat}>
                <div className={styles.mockQuestion}>
                    Which barrier did they say mattered most?
                </div>
                <div className={styles.mockAnswer}>
                    <PlaceholderLine width="90" />
                    <PlaceholderLine width="75" />
                    <PlaceholderLine width="85" />
                </div>
                <div className={styles.mockInput}>
                    <span>Ask a follow-up…</span>
                    <Image
                        src="/uparrowicon.svg"
                        alt=""
                        width={22}
                        height={14}
                        aria-hidden
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.mockPaper}>
            <p className={styles.mockPaperTitle}>
                Saved: CAR-T in solid tumors
            </p>
            <p className={styles.mockPaperMeta}>
                Library · 2 papers · 1 open gap
            </p>
            <div className={styles.mockPaperLines}>
                <PlaceholderLine width="95" />
                <PlaceholderLine width="78" />
                <PlaceholderLine width="66" />
            </div>
        </div>
    );
};

const AboutPage = () => {
    const { isLoggedIn } = useSession();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const activeIndexRef = useRef(0);
    const resumeTimerRef = useRef<number | null>(null);

    const setStep = useCallback((nextIndex: number) => {
        const normalized =
            ((nextIndex % steps.length) + steps.length) % steps.length;
        activeIndexRef.current = normalized;
        setActiveIndex(normalized);
    }, []);

    const pauseAutoPlay = useCallback(() => {
        setIsAutoPlaying(false);

        if (resumeTimerRef.current !== null) {
            window.clearTimeout(resumeTimerRef.current);
        }

        resumeTimerRef.current = window.setTimeout(() => {
            const reduceMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
            ).matches;
            if (!reduceMotion) setIsAutoPlaying(true);
            resumeTimerRef.current = null;
        }, RESUME_AFTER_INTERACTION_MS);
    }, []);

    const goNext = useCallback(() => {
        pauseAutoPlay();
        setStep(activeIndexRef.current + 1);
    }, [pauseAutoPlay, setStep]);

    const goPrev = useCallback(() => {
        pauseAutoPlay();
        setStep(activeIndexRef.current - 1);
    }, [pauseAutoPlay, setStep]);

    const goToStep = useCallback(
        (logicalIndex: number) => {
            pauseAutoPlay();
            setStep(logicalIndex);
        },
        [pauseAutoPlay, setStep],
    );

    useEffect(() => {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (!reduceMotion) setIsAutoPlaying(true);
    }, []);

    useEffect(() => {
        if (!isAutoPlaying) return;

        const timer = window.setInterval(() => {
            setStep(activeIndexRef.current + 1);
        }, AUTO_ADVANCE_MS);

        return () => window.clearInterval(timer);
    }, [isAutoPlaying, setStep]);

    useEffect(() => {
        return () => {
            if (resumeTimerRef.current !== null) {
                window.clearTimeout(resumeTimerRef.current);
            }
        };
    }, []);

    const activeStep = steps[activeIndex];

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <p className={styles.eyebrow}>How it works</p>
                <h1>Discover. Search. Read. Keep.</h1>
                <p className={styles.lede}>
                    Start with a question across the literature, or open one
                    paper and stay with its text. Either way, you can save the
                    work and come back.
                </p>
            </header>

            <section className={styles.card} aria-label="How it works steps">
                <div
                    className={styles.steps}
                    role="tablist"
                    aria-label="Choose a step"
                >
                    {steps.map((step, index) => (
                        <button
                            key={step.number}
                            type="button"
                            role="tab"
                            id={`about-step-${step.number}`}
                            aria-selected={index === activeIndex}
                            aria-controls="about-step-preview"
                            className={`${styles.step} ${
                                index === activeIndex ? styles.stepActive : ""
                            }`}
                            onClick={() => goToStep(index)}
                        >
                            <span className={styles.stepNumber}>
                                {step.number}
                            </span>
                            <span className={styles.stepCopy}>
                                <span className={styles.stepTitle}>
                                    {step.title}
                                </span>
                                <span className={styles.stepDescription}>
                                    {step.description}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>

                <div
                    className={styles.previewPane}
                    role="tabpanel"
                    id="about-step-preview"
                    aria-labelledby={`about-step-${activeStep.number}`}
                >
                    <div className={styles.previewHeader}>
                        <p className={styles.previewLabel}>
                            A peek at {activeStep.title}
                        </p>
                        <div className={styles.previewNav}>
                            <button
                                type="button"
                                className={styles.navButton}
                                onClick={goPrev}
                                aria-label="Previous step"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                className={styles.navButton}
                                onClick={goNext}
                                aria-label="Next step"
                            >
                                ›
                            </button>
                        </div>
                    </div>
                    <div className={styles.stepPreview}>
                        <StepPreview index={activeIndex} />
                    </div>
                    <p className={styles.progressText}>
                        Step {activeIndex + 1} of {steps.length}
                        {isAutoPlaying ? (
                            <span className={styles.autoHint}>
                                {" "}
                                · playing
                            </span>
                        ) : (
                            <span> · paused</span>
                        )}
                    </p>
                </div>
            </section>

            <section className={styles.notes}>
                <h2>The fine print, lightly</h2>
                <ul>
                    {notes.map((note) => (
                        <li key={note.title}>
                            <h3>{note.title}</h3>
                            <p>{note.body}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className={styles.cta}>
                <div className={styles.ctaCopy}>
                    <p className={styles.eyebrow}>Ready when you are</p>
                    <h2>
                        {isLoggedIn
                            ? "Your research workspace is waiting."
                            : "Try a discovery, or search for papers."}
                    </h2>
                </div>
                <div className={styles.ctaActions}>
                    <Link href="/discover" className={styles.primaryButton}>
                        Start researching
                    </Link>
                    {isLoggedIn ? (
                        <Link
                            href="/savedpapers"
                            className={styles.secondaryLink}
                        >
                            Research Library
                        </Link>
                    ) : (
                        <Link
                            href="/discover?mode=search"
                            className={styles.secondaryLink}
                        >
                            Search papers
                        </Link>
                    )}
                </div>
            </section>

            <p className={styles.contactHint}>
                Questions about the product?{" "}
                <Link href="/contact">Contact Meredith</Link>
            </p>
        </div>
    );
};

export default AboutPage;
