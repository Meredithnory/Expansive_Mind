"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import styles from "./about.module.scss";
import ResearchOrbit from "../components/ResearchOrbit";
import { DEVELOPER_NAME } from "../lib/contact";
import { useSession } from "../lib/use-session";

const AUTO_ADVANCE_MS = 5000;
const RESUME_AFTER_INTERACTION_MS = 6000;

const SOURCES = [
    { label: "NIH PubMed Central", color: "#0ab1ff" },
    { label: "Springer Nature", color: "#ff5aa9" },
    { label: "Europe PMC", color: "#22a06b" },
    { label: "Crossref", color: "#f5a524" },
    { label: "Google Scholar (Pro)", color: "#8b5cf6" },
];

const steps = [
    {
        name: "Discover",
        label: "1 · Discover",
        tone: "pink",
        title: "Synthesize evidence across papers",
        description:
            "Ask one question. See what the open papers report, where they conflict, and what they leave open.",
    },
    {
        name: "Read",
        label: "2 · Read",
        tone: "blue",
        title: "Trace every claim to its source",
        description:
            "Ask about a passage. The reply stays inside that paper, and you can jump back to the lines.",
    },
    {
        name: "Plan",
        label: "3 · Plan",
        tone: "amber",
        title: "Turn evidence gaps into next steps",
        description:
            "Save the papers and the thread, or turn a gap into the next experiment.",
    },
] as const;

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

const ArrowIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const CheckIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const ChevronIcon = ({ direction }: { direction: "prev" | "next" }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d={direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/** Illustrations only: the same sample brief the homepage shows. */
const StepPreview = ({ index }: { index: number }) => {
    if (index === 0) {
        return (
            <div className={styles.preview} aria-hidden="true">
                <div className={styles.mockAsk}>
                    <span className={styles.mockQuestion}>
                        Does GLP-1 receptor agonism reduce cardiovascular events
                        in type 2 diabetes?
                    </span>
                    <div className={styles.mockAskBar}>
                        <div className={styles.mockChecks}>
                            <span className={styles.mockCheck}>
                                <CheckIcon />
                                Specific enough
                            </span>
                            <span className={styles.mockCheck}>
                                <CheckIcon />
                                Has an outcome
                            </span>
                        </div>
                        <span className={styles.mockRun}>
                            Run discovery
                            <ArrowIcon size={14} />
                        </span>
                    </div>
                </div>
                <div className={styles.mockPanel}>
                    <span className={styles.mockKicker}>Topic synthesis · 9 papers</span>
                    <span className={styles.mockGap}>
                        <strong data-tone="pink">Gap 1</strong>
                        Mechanisms of cardiovascular protection beyond measured
                        risk factors
                    </span>
                    <span className={styles.mockGap}>
                        <strong>Gap 2</strong>
                        Hard outcomes for combination GLP-1 RA and SGLT2
                        inhibitor therapy
                    </span>
                    <span className={styles.mockGap}>
                        <strong>Gap 3</strong>
                        Functional consequences of lean mass reduction during
                        weight loss
                    </span>
                </div>
            </div>
        );
    }

    if (index === 1) {
        return (
            <div className={styles.preview} aria-hidden="true">
                <div className={styles.mockPanel}>
                    <span className={styles.mockCite}>¶ Introduction · Show in paper</span>
                    <span className={styles.mockHighlight}>
                        “only approximately 30–40% of the MACE reduction… is
                        explained by changes in measured cardiometabolic risk
                        factors”
                    </span>
                </div>
                <div className={styles.mockChat}>
                    <div className={styles.mockChatHead}>
                        <span>Paper assistant</span>
                        <span>Uses Claude by Anthropic</span>
                    </div>
                    <span className={styles.mockAsked}>
                        How much of the benefit do the risk factors explain?
                    </span>
                    <span className={styles.mockAnswer}>
                        Only about 30–40% of the MACE reduction, according to the
                        introduction.{" "}
                        <span className={styles.mockChip}>¶ Introduction</span>
                    </span>
                    <div className={styles.mockInput}>
                        <span>Ask about this paper…</span>
                        <span className={styles.mockSend}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M12 19V5M6 11l6-6 6 6"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </span>
                    </div>
                    <span className={styles.mockDisclaimer}>
                        Answers can be wrong. Check the cited passages. Not medical
                        advice.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.preview} aria-hidden="true">
            <div className={styles.mockShare}>
                <div className={styles.mockShareHead}>
                    <span>Share your brief</span>
                    <span>Anyone with the link can read it. No account needed.</span>
                </div>
                <div className={styles.mockLink}>
                    <span>expansivemind.ai/brief/OUbLD3_1sraw</span>
                    <span className={styles.mockCopy}>Copy link</span>
                </div>
                <div className={styles.mockAudience}>
                    <div>
                        <span data-tone="green">People will see</span>
                        <span>
                            Your question · the cited brief · the claim ledger ·
                            the papers behind it
                        </span>
                    </div>
                    <div>
                        <span>Stays private</span>
                        <span>
                            Your paper chats · your highlights and notes · your
                            projects
                        </span>
                    </div>
                </div>
            </div>
            <span className={styles.mockRow}>
                Start a project
                <span>→</span>
            </span>
        </div>
    );
};

const AboutPage = () => {
    const { isLoggedIn } = useSession();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const activeIndexRef = useRef(0);
    const resumeTimerRef = useRef<number | null>(null);
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

    const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        const last = steps.length - 1;
        const moves: Record<string, number> = {
            ArrowDown: activeIndexRef.current + 1,
            ArrowRight: activeIndexRef.current + 1,
            ArrowUp: activeIndexRef.current - 1,
            ArrowLeft: activeIndexRef.current - 1,
            Home: 0,
            End: last,
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const next = ((moves[event.key] % steps.length) + steps.length) % steps.length;
        goToStep(next);
        tabRefs.current[next]?.focus();
    };

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
            <ResearchOrbit />

            <header className={styles.hero}>
                <p className={styles.kicker}>About</p>
                <h1>Evidence, made actionable.</h1>
                <p className={styles.lede}>
                    Start with a question across the literature, or open one
                    paper and stay with its text. Either way, you can save the
                    work and come back.
                </p>
                <div className={styles.sources}>
                    <span className={styles.sourcesLabel}>
                        Reads open-access papers from
                    </span>
                    {SOURCES.map((source) => (
                        <span key={source.label} className={styles.source}>
                            <span
                                className={styles.sourceDot}
                                style={{ background: source.color }}
                                aria-hidden="true"
                            />
                            {source.label}
                        </span>
                    ))}
                </div>
            </header>

            <section className={styles.how} aria-labelledby="about-how-title">
                <div className={styles.sectionHead}>
                    <p className={styles.kicker}>How it works</p>
                    <h2 id="about-how-title">
                        You bring the question. We do the digging.
                    </h2>
                </div>

                <div className={styles.howGrid}>
                    <div className={styles.stepColumn}>
                        <div
                            className={styles.steps}
                            role="tablist"
                            aria-label="Choose a step"
                            aria-orientation="vertical"
                        >
                            {steps.map((step, index) => {
                                const selected = index === activeIndex;
                                return (
                                    <button
                                        key={step.name}
                                        ref={(node) => {
                                            tabRefs.current[index] = node;
                                        }}
                                        type="button"
                                        role="tab"
                                        id={`about-step-${index + 1}`}
                                        aria-selected={selected}
                                        aria-controls="about-step-preview"
                                        tabIndex={selected ? 0 : -1}
                                        className={styles.step}
                                        data-tone={step.tone}
                                        onClick={() => goToStep(index)}
                                        onKeyDown={handleTabKey}
                                    >
                                        <span className={styles.stepName}>
                                            {step.name}
                                        </span>
                                        <span
                                            className={styles.stepLabel}
                                            data-tone={step.tone}
                                        >
                                            {step.label}
                                        </span>
                                        <span className={styles.stepTitle}>
                                            {step.title}
                                        </span>
                                        <span className={styles.stepDescription}>
                                            {step.description}
                                        </span>
                                        {selected && isAutoPlaying ? (
                                            <span
                                                key={activeIndex}
                                                className={styles.stepProgress}
                                                data-tone={step.tone}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                        <Link href="/discover?mode=search" className={styles.searchAside}>
                            <span className={styles.searchAsideCopy}>
                                <span className={styles.stepLabel} data-tone="blue">
                                    Or · Search
                                </span>
                                <span className={styles.stepDescription}>
                                    Start from a paper instead. Look it up across
                                    the indexes and open the one you mean.
                                </span>
                            </span>
                            <ArrowIcon size={18} />
                        </Link>
                    </div>

                    <div
                        className={styles.previewPane}
                        role="tabpanel"
                        id="about-step-preview"
                        aria-labelledby={`about-step-${activeIndex + 1}`}
                        data-tone={activeStep.tone}
                    >
                        {/* Narrow screens: the tabs shrink to names, so the
                            step's copy moves into the panel. */}
                        <div className={styles.previewStep}>
                            <span
                                className={styles.stepLabel}
                                data-tone={activeStep.tone}
                            >
                                {activeStep.label}
                            </span>
                            <span className={styles.stepTitle}>
                                {activeStep.title}
                            </span>
                            <span className={styles.stepDescription}>
                                {activeStep.description}
                            </span>
                        </div>
                        <div className={styles.previewHeader}>
                            <p className={styles.previewLabel}>
                                A peek at {activeStep.name}
                            </p>
                            <div className={styles.previewNav}>
                                <button
                                    type="button"
                                    className={styles.navButton}
                                    onClick={goPrev}
                                    aria-label="Previous step"
                                >
                                    <ChevronIcon direction="prev" />
                                </button>
                                <button
                                    type="button"
                                    className={styles.navButton}
                                    onClick={goNext}
                                    aria-label="Next step"
                                >
                                    <ChevronIcon direction="next" />
                                </button>
                            </div>
                        </div>
                        <div className={styles.previewBody} key={`body-${activeIndex}`}>
                            <StepPreview index={activeIndex} />
                        </div>
                        <p className={styles.progressText}>
                            Step {activeIndex + 1} of {steps.length} ·{" "}
                            {isAutoPlaying ? "playing" : "paused"}
                        </p>
                        {isAutoPlaying ? (
                            <span
                                key={`progress-${activeIndex}`}
                                className={styles.paneProgress}
                                data-tone={activeStep.tone}
                                aria-hidden="true"
                            />
                        ) : null}
                    </div>
                </div>
            </section>

            <section className={styles.notes} aria-labelledby="about-notes-title">
                <h2 id="about-notes-title">The fine print, lightly</h2>
                <ul>
                    {notes.map((note) => (
                        <li key={note.title}>
                            <h3>{note.title}</h3>
                            <p>{note.body}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className={styles.builder} aria-labelledby="about-builder-title">
                <div className={styles.builderCopy}>
                    <p className={styles.kicker}>Who builds it</p>
                    <h2 id="about-builder-title">Built by {DEVELOPER_NAME}</h2>
                    <p>
                        Questions, bugs, ideas, or a quick hello — it all goes
                        to her inbox.
                    </p>
                    <Link href="/contact" className={styles.outlineLink}>
                        Contact {DEVELOPER_NAME.split(" ")[0]} →
                    </Link>
                </div>
                <blockquote className={styles.quote}>
                    “Research should be the part you look forward to. I built
                    Expansive Mind to handle the searching and sorting, so more
                    of your time goes to thinking about the science.”
                </blockquote>
            </section>

            <section className={styles.cta} aria-labelledby="about-cta-title">
                <p className={styles.kicker}>Ready when you are</p>
                <h2 id="about-cta-title">
                    {isLoggedIn
                        ? "Your research workspace is waiting."
                        : "Try a discovery, or search for papers."}
                </h2>
                <div className={styles.ctaActions}>
                    <Link href="/discover" className={styles.primaryButton}>
                        Start researching
                    </Link>
                    {isLoggedIn ? (
                        <Link href="/savedpapers" className={styles.secondaryButton}>
                            Research Library
                        </Link>
                    ) : (
                        <Link
                            href="/discover?mode=search"
                            className={styles.secondaryButton}
                        >
                            Search papers
                        </Link>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AboutPage;
