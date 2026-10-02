"use client";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./home.module.scss";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "./lib/use-session";
import { SITE_STATUS } from "./components/site-status";
import { SCHOLAR_SOURCE_LABEL } from "./lib/payments";

const EXAMPLES = [
    "What limits CAR-T cell persistence and efficacy in solid tumors?",
    "How do gut microbiome metabolites influence Parkinson's disease progression?",
    "Do senolytic therapies improve outcomes in age-related pulmonary fibrosis?",
];

const SOURCES = [
    { label: "NIH PubMed Central", color: "#0ab1ff" },
    { label: "Springer Nature", color: "#ff5aa9" },
    { label: "Europe PMC", color: "#22a06b" },
    { label: "Crossref", color: "#f5a524" },
    { label: SCHOLAR_SOURCE_LABEL, color: "#8b5cf6" },
];

/** A public brief made with Discovery, so visitors see the output first. */
const SAMPLE_BRIEF_HREF = "/brief/OUbLD3_1sraw";

const ArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default function Home() {
    const router = useRouter();
    const { isLoggedIn, loading } = useSession();
    const [showVideo, setShowVideo] = useState(true);
    const [question, setQuestion] = useState("");
    const heroRef = useRef<HTMLElement>(null);

    // The video is pinned to the window so it can run edge to edge; this
    // keeps it (and its fade) inside the hero's band as the page scrolls.
    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;
        const root = document.documentElement;
        let frame = 0;
        const update = () => {
            frame = 0;
            const box = hero.getBoundingClientRect();
            root.style.setProperty("--home-hero-bottom", `${Math.max(0, Math.round(box.bottom))}px`);
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", schedule, { passive: true, capture: true });
        window.addEventListener("resize", schedule);
        const observer = new ResizeObserver(schedule);
        observer.observe(hero);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule, { capture: true });
            window.removeEventListener("resize", schedule);
            observer.disconnect();
            root.style.removeProperty("--home-hero-bottom");
        };
    }, []);

    useEffect(() => {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reduceMotion) setShowVideo(false);
    }, []);

    const askDiscovery = (event?: FormEvent) => {
        event?.preventDefault();
        const trimmed = question.trim();
        if (!trimmed) return;
        router.push(`/discover?q=${encodeURIComponent(trimmed)}`);
    };

    const onQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
            return;
        }
        event.preventDefault();
        askDiscovery();
    };

    return (
        <div className={styles.home}>
            <div className={styles.heroBackdrop} aria-hidden="true">
                {showVideo ? (
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster="/dnabg-poster.jpg"
                    >
                        <source src="/dnabg.mp4" type="video/mp4" />
                        <source src="/dnabg.webm" type="video/webm" />
                    </video>
                ) : null}
                <div className={styles.heroShade} />
                <div className={styles.heroFade} />
            </div>
            <section ref={heroRef} className={styles.hero}>
                <div className={styles.heroInner}>
                    <div className={styles.heroTop}>
                        {loading ? null : isLoggedIn ? (
                            <Link href="/savedpapers" className={styles.heroTopLink}>
                                Research Library
                            </Link>
                        ) : (
                            <Link href="/login" className={styles.heroTopLink}>
                                Log in
                            </Link>
                        )}
                    </div>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>Evidence, made actionable</p>
                        <div className={styles.brand}>
                            <h1>
                                Expansive Mind
                                <span
                                    className={styles.beta}
                                    title={SITE_STATUS.srLabel}
                                >
                                    <span aria-hidden="true">{SITE_STATUS.label}</span>
                                    <span className={styles.srOnly}>
                                        {SITE_STATUS.srLabel}
                                    </span>
                                </span>
                            </h1>
                            <Image
                                src="/brainlogo.svg"
                                alt=""
                                width={64}
                                height={64}
                                priority
                                className={styles.brandLogo}
                            />
                        </div>
                        <p className={styles.tagline}>
                            Ask a research question, understand the evidence
                            across papers, then check every source behind the
                            synthesis.
                        </p>
                        <form className={styles.ask} onSubmit={askDiscovery}>
                            <label className={styles.srOnly} htmlFor="home-question">
                                Research question
                            </label>
                            <textarea
                                id="home-question"
                                rows={2}
                                maxLength={2000}
                                placeholder="Ask a research question…"
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                onKeyDown={onQuestionKeyDown}
                            />
                            <div className={styles.askBar}>
                                <Link
                                    href="/discover?mode=search"
                                    className={styles.askSearch}
                                >
                                    or search for a paper
                                </Link>
                                <button
                                    type="submit"
                                    className={styles.askSubmit}
                                    disabled={!question.trim()}
                                >
                                    Discover
                                    <ArrowIcon />
                                </button>
                            </div>
                        </form>
                        <Link
                            href="/discover?mode=search"
                            className={styles.askSearchPhone}
                        >
                            or search for a paper
                        </Link>
                        <div className={styles.examples}>
                            {EXAMPLES.map((example) => (
                                <button
                                    key={example}
                                    type="button"
                                    className={styles.example}
                                    onClick={() => {
                                        setQuestion(example);
                                        document.getElementById("home-question")?.focus();
                                    }}
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                        {loading || isLoggedIn ? null : (
                            <p className={styles.loginHint}>
                                Already have an account? <Link href="/login">Log in</Link>
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <div className={styles.sources}>
                <span className={styles.sourcesLabel}>Reads open-access papers from</span>
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

            <section className={styles.how} aria-labelledby="home-how-title">
                <div className={styles.sectionHead}>
                    <p className={styles.kicker}>How it works</p>
                    <h2 id="home-how-title">You bring the question. We do the digging.</h2>
                </div>
                <div className={styles.steps}>
                    <article className={styles.step}>
                        <span className={styles.stepLabel} data-tone="pink">
                            1 · Discover
                        </span>
                        <span className={styles.stepTitle}>
                            Synthesize evidence across papers
                        </span>
                        <div className={styles.stepSample} aria-hidden="true">
                            <span className={styles.sampleKicker} data-tone="pink">
                                Gap 1
                            </span>
                            <span className={styles.sampleTitle}>
                                Mechanisms of cardiovascular protection beyond
                                measured risk factors
                            </span>
                            <span className={styles.sampleMeta}>Established · 2 papers</span>
                        </div>
                    </article>
                    <article className={styles.step}>
                        <span className={styles.stepLabel} data-tone="blue">
                            2 · Read
                        </span>
                        <span className={styles.stepTitle}>
                            Trace every claim to its source
                        </span>
                        <div className={styles.stepSample} aria-hidden="true">
                            <span className={styles.sampleCite}>
                                ¶ Introduction · Show in paper
                            </span>
                            <span className={styles.sampleQuote}>
                                “only approximately 30–40% of the MACE
                                reduction… is explained by changes in measured
                                cardiometabolic risk factors”
                            </span>
                        </div>
                    </article>
                    <article className={styles.step}>
                        <span className={styles.stepLabel} data-tone="amber">
                            3 · Plan
                        </span>
                        <span className={styles.stepTitle}>
                            Turn evidence gaps into next steps
                        </span>
                        <div className={styles.stepSample} aria-hidden="true">
                            <span className={styles.sampleRow}>
                                Share brief
                                <span className={styles.sampleCopy}>Copy link</span>
                            </span>
                            <span className={styles.sampleRow}>
                                Start a project
                                <span className={styles.sampleArrow}>→</span>
                            </span>
                        </div>
                    </article>
                </div>
            </section>

            <section className={styles.sample} aria-labelledby="home-sample-title">
                <div className={styles.sampleCopyBlock}>
                    <p className={styles.kicker}>A real brief</p>
                    <h2 id="home-sample-title">See what you get before you sign up</h2>
                    <p className={styles.sampleLead}>
                        A cited brief anyone can open: the question, the gaps,
                        and the papers behind each claim.
                    </p>
                    <Link href={SAMPLE_BRIEF_HREF} className={styles.sampleLink}>
                        Open the sample brief →
                    </Link>
                </div>
                <div className={styles.samplePreview} aria-hidden="true">
                    <span className={styles.samplePreviewKicker}>
                        Topic synthesis
                    </span>
                    <span className={styles.samplePreviewTitle}>
                        Does GLP-1 receptor agonism reduce cardiovascular events
                        in type 2 diabetes?
                    </span>
                    <span className={styles.samplePreviewGap}>
                        <strong data-first="true">Gap 1</strong>
                        Mechanisms of cardiovascular protection beyond measured
                        risk factors
                    </span>
                    <span className={styles.samplePreviewGap}>
                        <strong>Gap 2</strong>
                        Hard outcomes for combination GLP-1 RA and SGLT2
                        inhibitor therapy
                    </span>
                    <span className={styles.samplePreviewGap}>
                        <strong>Gap 3</strong>
                        Functional consequences of lean mass reduction during
                        weight loss
                    </span>
                </div>
            </section>

            <section className={styles.trust} aria-label="Why people trust it">
                <div>
                    <h3>Every claim has a source</h3>
                    <p>
                        Findings link to the passage they came from, so you can
                        check them.
                    </p>
                </div>
                <div>
                    <h3>Private AI</h3>
                    <p>AI requests run with zero data retention.</p>
                </div>
                <div>
                    <h3>Independent</h3>
                    <p>
                        Not affiliated with the databases it reads. Not medical
                        advice.
                    </p>
                </div>
            </section>

            <section className={styles.final} aria-labelledby="home-final-title">
                <h2 id="home-final-title">Start with one question</h2>
                <p>Free to start.</p>
                <div className={styles.finalActions}>
                    <Link href="/discover" className={styles.finalPrimary}>
                        Discover a question
                    </Link>
                    <Link href="/discover?mode=search" className={styles.finalSecondary}>
                        Search for a paper
                    </Link>
                </div>
            </section>
        </div>
    );
}
