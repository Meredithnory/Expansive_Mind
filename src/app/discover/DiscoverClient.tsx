"use client";
// Types live in ./discover-types.ts — read that before this 1.3k-line island.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import styles from "./discover.module.scss";
import posthog from "posthog-js";
import { useSession } from "../lib/use-session";
import {
    GUEST_UPGRADE_PROMPTED_KEY,
    GUEST_UPGRADE_VIEW_MS,
    parseGuestDiscoveryResult,
    parseGuestOpportunityReport,
    readGuestDiscoveryResult,
    writeGuestDiscoveryResult,
    shouldPromptGuestUpgrade,
} from "../lib/guest-discovery";
import type {
    DiscoverAgentStep,
    DiscoveryQuota,
    DiscoverResponse,
    OpportunityReport,
    PaperExtraction,
} from "./discover-types";
import {
    evidenceMixLabel,
    evidenceTypeLabel,
    extractionForPaper,
    yearRangeLabel,
} from "../lib/evidence-type";
import { buildPaperFocusHref } from "../lib/paper-sources";

const Markdown = dynamic(() => import("react-markdown"), {
    loading: () => <div className="loading-skeleton" aria-hidden="true" />,
});
const GuestUpgradeModal = dynamic(() => import("./GuestUpgradeModal"));
const OpportunityReportView = dynamic(
    () => import("./OpportunityReportView"),
    {
        loading: () => (
            <div className="loading-skeleton" role="status">
                Formatting opportunity report…
            </div>
        ),
    },
);
const PaperPreviewDrawer = dynamic(() => import("./PaperPreviewDrawer"));

const autoStartedQueries = new Set<string>();

const STEP_COPY: Record<Exclude<DiscoverAgentStep, "idle" | "done">, string> = {
    checking: "Taking a look at your question…",
    expanding: "Expanding your question into targeted searches…",
    searching: "Searching Springer Nature, NIH PubMed Central, and Google Scholar…",
    reading: "Reading licensed paper excerpts…",
    extracting: "Extracting findings, methods, and limitations…",
    analyzing: "Analyzing gaps and contradictions…",
    composing: "Composing the opportunity report…",
};

const AGENT_STEPS: Array<{
    id: Exclude<DiscoverAgentStep, "idle" | "done">;
    label: string;
}> = [
    { id: "expanding", label: "Expanding your question" },
    { id: "searching", label: "Searching literature" },
    { id: "reading", label: "Reading papers" },
    { id: "extracting", label: "Extracting findings" },
    { id: "analyzing", label: "Analyzing gaps" },
    { id: "composing", label: "Composing report" },
];

const STEP_ORDER: Record<DiscoverAgentStep, number> = {
    idle: -1,
    checking: -1,
    expanding: 0,
    searching: 1,
    reading: 2,
    extracting: 3,
    analyzing: 4,
    composing: 5,
    done: 6,
};

type BriefSection = {
    title: string;
    content: string;
};

function looksLikeReportJson(brief: string): boolean {
    const trimmed = brief.trim();
    return (
        (trimmed.startsWith("{") || trimmed.startsWith("```")) &&
        (trimmed.includes('"sections"') || trimmed.includes('"stateOfScience"'))
    );
}

function parseBriefSections(brief: string): BriefSection[] {
    if (looksLikeReportJson(brief)) {
        return [
            {
                title: "Research synthesis",
                content:
                    "The opportunity report was generated, but it could not be formatted for this view. Run discovery again to refresh it.",
            },
        ];
    }
    const matches = Array.from(brief.matchAll(/^##\s+(.+)$/gm));
    if (matches.length === 0) {
        return [{ title: "Research synthesis", content: brief.trim() }];
    }

    return matches.map((match, index) => {
        const contentStart = (match.index ?? 0) + match[0].length;
        const contentEnd =
            index + 1 < matches.length
                ? (matches[index + 1].index ?? brief.length)
                : brief.length;
        return {
            title: match[1].trim(),
            content: brief.slice(contentStart, contentEnd).trim(),
        };
    });
}

const PAPER_REF_PATTERN =
    /\bPaper\s+(\d+)(?:\s*[·•\-–—]\s*[A-Za-z][\w\s/-]*)?/gi;

function linkPaperReferences(content: string, paperCount: number): string {
    return content.replace(PAPER_REF_PATTERN, (match, indexText) => {
        const index = Number.parseInt(indexText, 10);
        if (!Number.isFinite(index) || index < 1 || index > paperCount) {
            return match;
        }
        return `[${match}](#discover-paper-${index})`;
    });
}

function sourceMixLabel(result: DiscoverResponse): string {
    const sources = new Set(
        result.papers.map((paper) => paper.database),
    );
    const labels: string[] = [];
    if (sources.has("springer")) labels.push("Springer Nature");
    if (sources.has("nih") || result.meta.usedNihFill) {
        labels.push("NIH PMC");
    }
    if (sources.has("scholar") || result.meta.usedScholar) {
        labels.push("Google Scholar");
    }
    return labels.length > 0
        ? labels.join(" · ")
        : "Springer Nature, NIH PMC, and Google Scholar";
}

function evidenceBadgeClass(type: string | undefined) {
    if (type === "rct" || type === "observational") {
        return styles.evidenceClinical;
    }
    if (type === "review") return styles.evidenceReview;
    if (type === "in-vitro" || type === "animal") {
        return styles.evidencePreclinical;
    }
    if (type === "computational") return styles.evidenceComputational;
    return styles.evidenceOther;
}

function paperIdFromHref(href?: string): number | null {
    if (!href) return null;
    const match = href.match(/^#discover-paper-(\d+)$/);
    return match ? Number.parseInt(match[1], 10) : null;
}

function reportSectionCount(report: OpportunityReport): number {
    const { sections } = report;
    return [
        sections.stateOfScience,
        sections.gaps.length,
        sections.problems.length,
        sections.venturePotential.length,
        sections.couldNotVerify.length,
        sections.projectSeeds.length,
    ].filter(Boolean).length;
}

type DiscoverClientProps = {
    qParam: string;
    savedParam: string;
    hero: ReactNode;
};

function DiscoverClient({ qParam, savedParam, hero }: DiscoverClientProps) {
    const {
        isLoggedIn,
        loading: sessionLoading,
        refresh,
    } = useSession();

    const [question, setQuestion] = useState(qParam);
    const [step, setStep] = useState<DiscoverAgentStep>("idle");
    const [error, setError] = useState<string | null>(null);
    const [showPlanLink, setShowPlanLink] = useState(false);
    const [result, setResult] = useState<DiscoverResponse | null>(null);
    const [savedDiscoveries, setSavedDiscoveries] = useState<
        DiscoverResponse[]
    >([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [shareStatus, setShareStatus] = useState<
        "idle" | "loading" | "copied" | "error"
    >("idle");
    const [discoveryQuota, setDiscoveryQuota] =
        useState<DiscoveryQuota | null>(null);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [upgradeExhausted, setUpgradeExhausted] = useState(false);
    const [highlightedPaper, setHighlightedPaper] = useState<number | null>(
        null,
    );
    const [previewPaperIndex, setPreviewPaperIndex] = useState<number | null>(
        null,
    );
    const pageRef = useRef<HTMLDivElement>(null);
    const citeTriggerRef = useRef<HTMLElement | null>(null);
    const analysisEndRef = useRef<HTMLDivElement>(null);

    const loadSavedDiscoveries = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch("/api/discover", {
                cache: "no-store",
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    typeof data.error === "string"
                        ? data.error
                        : "Unable to load saved discoveries.",
                );
            }
            const discoveries = Array.isArray(data.discoveries)
                ? data.discoveries
                : [];
            setSavedDiscoveries(isLoggedIn ? discoveries : []);
            if (data.quota) setDiscoveryQuota(data.quota);
            const lastGuestBrief = discoveries[0];
            const parsedGuest = parseGuestDiscoveryResult(lastGuestBrief);
            if (
                !isLoggedIn &&
                data.quota?.remaining === 0 &&
                parsedGuest
            ) {
                setResult(
                    (current) => current ?? (parsedGuest as DiscoverResponse),
                );
                setStep((current) => (current === "idle" ? "done" : current));
                writeGuestDiscoveryResult(parsedGuest);
            }
        } catch (err) {
            if (savedParam) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load that saved synthesis.",
                );
            }
        } finally {
            setHistoryLoading(false);
        }
    }, [isLoggedIn, savedParam]);

    useEffect(() => {
        if (sessionLoading) return;
        void loadSavedDiscoveries();
    }, [loadSavedDiscoveries, sessionLoading]);

    useEffect(() => {
        if (qParam) setQuestion(qParam);
    }, [qParam]);

    useEffect(() => {
        if (!savedParam || historyLoading || !isLoggedIn) return;
        const saved = savedDiscoveries.find(
            (discovery) => discovery.id === savedParam,
        );
        if (!saved) {
            setError("That saved synthesis could not be found.");
            return;
        }
        setResult(saved);
        setError(null);
        setStep("done");
    }, [historyLoading, isLoggedIn, savedDiscoveries, savedParam]);

    useEffect(() => {
        if (sessionLoading || isLoggedIn || result) return;
        const stored = readGuestDiscoveryResult();
        if (!stored) return;
        const query = qParam.trim();
        const canRunNew =
            discoveryQuota == null ||
            discoveryQuota.unlimited ||
            (discoveryQuota.remaining ?? 0) > 0;
        if (query && canRunNew && stored.question !== query) return;
        setResult(stored as DiscoverResponse);
        setStep("done");
    }, [discoveryQuota, isLoggedIn, qParam, result, sessionLoading]);

    useEffect(() => {
        if (!result || result.noResults || isLoggedIn || sessionLoading) return;
        if (typeof window === "undefined") return;
        if (window.sessionStorage.getItem(GUEST_UPGRADE_PROMPTED_KEY)) return;

        const sentinel = analysisEndRef.current;
        const startedBelowFold = sentinel
            ? sentinel.getBoundingClientRect().top > window.innerHeight - 80
            : Boolean(result.brief);
        const startedAt = Date.now();
        let prompted = false;

        const promptUpgrade = () => {
            if (prompted) return;
            prompted = true;
            window.sessionStorage.setItem(GUEST_UPGRADE_PROMPTED_KEY, "true");
            setUpgradeExhausted(true);
            setUpgradeOpen(true);
        };

        const maybePrompt = () => {
            const visible = sentinel
                ? sentinel.getBoundingClientRect().top <
                  window.innerHeight * 0.85
                : false;
            if (
                shouldPromptGuestUpgrade({
                    elapsedMs: Date.now() - startedAt,
                    analysisWasBelowFold: startedBelowFold,
                    analysisIsVisible: visible,
                })
            ) {
                promptUpgrade();
            }
        };

        const timer = window.setTimeout(promptUpgrade, GUEST_UPGRADE_VIEW_MS);
        const page = pageRef.current;
        const onScroll = () => maybePrompt();
        page?.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.clearTimeout(timer);
            page?.removeEventListener("scroll", onScroll);
            window.removeEventListener("scroll", onScroll);
        };
    }, [isLoggedIn, result, sessionLoading]);

    useEffect(() => {
        if (highlightedPaper === null) return;
        const timer = window.setTimeout(
            () => setHighlightedPaper(null),
            2_200,
        );
        return () => window.clearTimeout(timer);
    }, [highlightedPaper]);

    const isRunning = step !== "idle" && step !== "done";
    const guestExhausted =
        !sessionLoading &&
        !isLoggedIn &&
        discoveryQuota?.remaining === 0;
    const guestLimit = discoveryQuota?.limit ?? 1;

    useEffect(() => {
        setShareStatus("idle");
        setPreviewPaperIndex(null);
    }, [result?.id]);

    const canShareResult = Boolean(
        isLoggedIn && result && /^[a-f0-9]{24}$/i.test(result.id),
    );

    const handleShareResult = useCallback(async () => {
        if (!result || shareStatus === "loading") return;
        setShareStatus("loading");
        try {
            const res = await fetch("/api/discover/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: result.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.slug) {
                throw new Error(data.error || "Unable to share this brief.");
            }
            await navigator.clipboard.writeText(
                `${window.location.origin}/brief/${data.slug}`,
            );
            setShareStatus("copied");
            window.setTimeout(() => setShareStatus("idle"), 2_500);
        } catch {
            setShareStatus("error");
            window.setTimeout(() => setShareStatus("idle"), 2_500);
        }
    }, [result, shareStatus]);

    const statusLabel = useMemo(() => {
        if (step === "idle" || step === "done") return null;
        return STEP_COPY[step];
    }, [step]);

    const structuredReport = useMemo(
        () =>
            parseGuestOpportunityReport(result?.report) ??
            parseGuestOpportunityReport(result?.brief),
        [result],
    );

    const briefSections = useMemo(
        () =>
            result && !structuredReport
                ? parseBriefSections(result.brief)
                : [],
        [result, structuredReport],
    );

    const scrollToPaper = useCallback((paperIndex: number) => {
        const target = document.getElementById(
            `discover-paper-${paperIndex}`,
        );
        if (!target) return;
        setHighlightedPaper(paperIndex);
        target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, []);

    const keepAskFieldHorizontallyInView = useCallback(() => {
        const resetX = () => {
            if (typeof window === "undefined") return;
            if (window.scrollX !== 0) {
                window.scrollTo(0, window.scrollY);
            }
            document.documentElement.scrollLeft = 0;
            document.body.scrollLeft = 0;
            const page = pageRef.current;
            if (page) page.scrollLeft = 0;
        };
        resetX();
        window.requestAnimationFrame(resetX);
    }, []);

    const openPaperPreview = useCallback(
        (paperIndex: number, trigger?: HTMLElement | null) => {
            const exists = result?.papers.some(
                (paper) => paper.index === paperIndex,
            );
            if (!exists) return;
            if (trigger) citeTriggerRef.current = trigger;
            setPreviewPaperIndex(paperIndex);
        },
        [result],
    );

    const closePaperPreview = useCallback(() => {
        setPreviewPaperIndex(null);
        const trigger = citeTriggerRef.current;
        window.requestAnimationFrame(() => trigger?.focus());
    }, []);

    const seePaperInSources = useCallback(
        (paperIndex: number) => {
            citeTriggerRef.current = null;
            setPreviewPaperIndex(null);
            window.requestAnimationFrame(() => scrollToPaper(paperIndex));
        },
        [scrollToPaper],
    );

    const previewPaper = useMemo(
        () =>
            result?.papers.find((paper) => paper.index === previewPaperIndex) ??
            null,
        [previewPaperIndex, result],
    );

    const previewExtraction = useMemo(
        () =>
            previewPaperIndex == null
                ? null
                : extractionForPaper(result?.extractions, previewPaperIndex) ??
                  null,
        [previewPaperIndex, result],
    );

    const evidenceMix = useMemo(() => {
        if (!result) return "";
        const mix = evidenceMixLabel(result.extractions);
        const years = yearRangeLabel([
            ...(result.papers.map((paper) => paper.date) ?? []),
            ...(result.extractions?.map((item) => item.publicationDate) ?? []),
        ]);
        return [mix, years].filter(Boolean).join(" · ");
    }, [result]);

    const markdownComponents = useMemo(
        () => ({
            a: ({
                href,
                children,
            }: {
                href?: string;
                children?: ReactNode;
            }) => {
                const paperIndex = paperIdFromHref(href);
                if (paperIndex !== null) {
                    return (
                        <button
                            type="button"
                            className={clsx(styles.paperCitation, {
                                [styles.paperCitationActive]:
                                    previewPaperIndex === paperIndex,
                            })}
                            aria-haspopup="dialog"
                            aria-expanded={previewPaperIndex === paperIndex}
                            aria-pressed={previewPaperIndex === paperIndex}
                            onClick={(event) =>
                                openPaperPreview(
                                    paperIndex,
                                    event.currentTarget,
                                )
                            }
                        >
                            {children}
                        </button>
                    );
                }
                return (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                    </a>
                );
            },
        }),
        [openPaperPreview, previewPaperIndex],
    );

    const restoreGuestBrief = useCallback(() => {
        const stored = readGuestDiscoveryResult();
        if (!stored) return false;
        setResult(stored as DiscoverResponse);
        setStep("done");
        return true;
    }, []);

    const runDiscovery = useCallback(
        async (eventOrQuestion?: React.FormEvent | string) => {
            if (eventOrQuestion && typeof eventOrQuestion !== "string") {
                eventOrQuestion.preventDefault();
            }
            const trimmed = (
                typeof eventOrQuestion === "string"
                    ? eventOrQuestion
                    : question
            ).trim();
            if (!trimmed || isRunning) return;
            if (!isLoggedIn && discoveryQuota?.remaining === 0) {
                restoreGuestBrief();
                return;
            }

            setError(null);
            setShowPlanLink(false);
            // Keep the current brief visible while a follow-up discovery runs.
            if (!result) setResult(null);
            // Don't pretend we expanded or started reading until the cheap
            // quality check has had a beat. Junk should bounce before this.
            setStep("checking");

            const timers = [
                window.setTimeout(() => setStep("expanding"), 3_000),
                window.setTimeout(() => setStep("searching"), 8_000),
                window.setTimeout(() => setStep("reading"), 20_000),
                window.setTimeout(() => setStep("extracting"), 36_000),
                window.setTimeout(() => setStep("analyzing"), 52_000),
                window.setTimeout(() => setStep("composing"), 68_000),
            ];

            try {
                const response = await fetch("/api/discover", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: trimmed }),
                });
                const data = await response.json().catch(() => ({}));
                if (isLoggedIn) void refresh();
                if (!response.ok) {
                    const blocked =
                        data.code === "QUOTA_EXCEEDED" ||
                        data.code === "UPGRADE_REQUIRED";
                    setShowPlanLink(blocked);
                    if (!isLoggedIn && blocked) {
                        setDiscoveryQuota(data.quota ?? discoveryQuota);
                        if (restoreGuestBrief()) {
                            return;
                        }
                    }
                    posthog.capture("discovery_blocked", {
                        status: response.status,
                        code: data.code,
                    });
                    throw new Error(
                        typeof data.error === "string"
                            ? data.error
                            : "Discovery failed.",
                    );
                }
                const savedResult = data as DiscoverResponse;
                if (savedResult.noResults) {
                    setResult(savedResult);
                    if (data.quota) setDiscoveryQuota(data.quota);
                    setHighlightedPaper(null);
                    setPreviewPaperIndex(null);
                    setStep("done");
                    posthog.capture("discovery_no_results", {
                        cache_hit: Boolean(data.cacheHit),
                    });
                    return;
                }
                if (!isLoggedIn) {
                    const cached = parseGuestDiscoveryResult(savedResult);
                    writeGuestDiscoveryResult(cached ?? savedResult);
                }
                setResult(savedResult);
                if (data.quota) setDiscoveryQuota(data.quota);
                if (isLoggedIn) {
                    setSavedDiscoveries((previous) => [
                        savedResult,
                        ...previous.filter(
                            (discovery) => discovery.id !== savedResult.id,
                        ),
                    ]);
                }
                setQuestion("");
                setHighlightedPaper(null);
                setPreviewPaperIndex(null);
                setStep("done");
                posthog.capture("discovery_completed", {
                    papers_used: data.meta?.papersUsed,
                    cache_hit: Boolean(data.cacheHit),
                });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Discovery is temporarily unavailable.",
                );
                setStep("idle");
            } finally {
                timers.forEach((timer) => window.clearTimeout(timer));
            }
        },
        [
            discoveryQuota,
            isLoggedIn,
            isRunning,
            question,
            refresh,
            restoreGuestBrief,
            result,
        ],
    );

    useEffect(() => {
        if (sessionLoading || historyLoading || isRunning || result) return;
        const query = qParam.trim();
        if (!query) return;
        if (!isLoggedIn && discoveryQuota == null) return;
        if (!isLoggedIn && discoveryQuota?.remaining === 0) return;
        if (autoStartedQueries.has(query)) return;
        autoStartedQueries.add(query);
        void runDiscovery(query);
    }, [
        discoveryQuota,
        historyLoading,
        isLoggedIn,
        isRunning,
        qParam,
        result,
        runDiscovery,
        sessionLoading,
    ]);

    return (
        <div
            ref={pageRef}
            className={clsx(styles.page, {
                [styles.initialPage]: !result || result.noResults,
                [styles.reportPage]: Boolean(result && !result.noResults),
                [styles.pageWithPreview]: previewPaperIndex !== null,
            })}
            data-page-scroll
        >
            <section
                className={clsx(styles.hero, {
                    [styles.heroCompact]: Boolean(result && !result.noResults),
                })}
            >
                {hero}
            </section>

            {!sessionLoading && !isLoggedIn && !guestExhausted && (
                <button
                    type="button"
                    className={styles.guestStatus}
                    onClick={() => {
                        setUpgradeExhausted(false);
                        setUpgradeOpen(true);
                    }}
                >
                    <span>
                        {`${discoveryQuota?.remaining ?? guestLimit} of ${guestLimit} guest Discovery remaining on this network`}
                    </span>
                    <strong>What is included?</strong>
                </button>
            )}

            <form
                className={clsx(styles.form, {
                    [styles.dockedForm]: Boolean(result && !result.noResults),
                })}
                onSubmit={runDiscovery}
            >
                <div className={styles.formHeading}>
                    <label className={styles.label} htmlFor="discover-question">
                        {result && !result.noResults
                            ? "Ask another research question"
                            : "Research question"}
                    </label>
                    <span className={styles.characterCount}>
                        {question.length.toLocaleString()} / 2,000
                    </span>
                </div>
                {guestExhausted ? (
                    <button
                        type="button"
                        className={styles.lockedPrompt}
                        onClick={() => {
                            setUpgradeExhausted(true);
                            setUpgradeOpen(true);
                        }}
                    >
                        <span>
                            <strong>Continue discovering with Researcher Pro</strong>
                            Your guest synthesis is complete.
                        </span>
                        <span aria-hidden="true">Unlock →</span>
                    </button>
                ) : (
                    <div className={styles.promptShell}>
                        <textarea
                            id="discover-question"
                            className={styles.textarea}
                            value={question}
                            onChange={(event) => setQuestion(event.target.value)}
                            onFocus={keepAskFieldHorizontallyInView}
                            aria-describedby="discover-supporting-metadata"
                            placeholder={
                                result && !result.noResults
                                    ? "Ask another question…"
                                    : "e.g. How does GLP-1 receptor agonism affect cardiovascular outcomes in type 2 diabetes?"
                            }
                            rows={result && !result.noResults ? 1 : 4}
                            maxLength={2000}
                            disabled={isRunning}
                        />
                        <button
                            type="submit"
                            className={styles.submit}
                            disabled={isRunning || !question.trim()}
                        >
                            <span>
                                {isRunning ? "Working…" : "Run discovery"}
                            </span>
                            <span
                                className={styles.submitIcon}
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </button>
                    </div>
                )}
                <div
                    id="discover-supporting-metadata"
                    className={styles.formFooter}
                >
                    <div className={styles.metadataGroup}>
                        <span className={styles.metadataLabel}>Sources</span>
                        <span className={styles.sourceSet}>
                            <span>Springer Nature</span>
                            <span>NIH PMC</span>
                            <span>Google Scholar</span>
                        </span>
                    </div>
                    <div className={styles.metadataGroup}>
                        <span className={styles.metadataLabel}>Analysis</span>
                        <span>Up to 10 papers</span>
                        <span>Licensed excerpts</span>
                    </div>
                </div>
            </form>

            {isRunning && (
                <section
                    className={clsx(styles.answerPreview, {
                        [styles.answerPreviewOverReport]:
                            Boolean(result && !result.noResults),
                    })}
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className={styles.progressTop}>
                        <span className={styles.progressPulse} />
                        <div>
                            <p className={styles.previewKicker}>
                                Your answer is taking shape
                            </p>
                            <p className={styles.status}>{statusLabel}</p>
                            <p className={styles.progressHint}>
                                Deep analysis reads up to 10 papers and can take
                                a minute or two.
                            </p>
                        </div>
                    </div>
                    <ol className={styles.progressSteps}>
                        {AGENT_STEPS.map((agentStep, index) => {
                            const isComplete = STEP_ORDER[step] > index;
                            const isActive = step === agentStep.id;
                            return (
                                <li
                                    key={agentStep.id}
                                    className={clsx(styles.progressStep, {
                                        [styles.progressStepComplete]: isComplete,
                                        [styles.progressStepActive]: isActive,
                                    })}
                                >
                                    <span className={styles.progressNumber}>
                                        {isComplete ? "✓" : index + 1}
                                    </span>
                                    <span>{agentStep.label}</span>
                                </li>
                            );
                        })}
                    </ol>
                    <div className={styles.answerSkeleton} aria-hidden="true">
                        <div className={styles.skeletonHeading} />
                        <div className={styles.skeletonLine} />
                        <div className={styles.skeletonLine} />
                        <div
                            className={clsx(
                                styles.skeletonLine,
                                styles.skeletonLineShort,
                            )}
                        />
                        <div className={styles.skeletonSources}>
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                </section>
            )}

            {error && (
                <div className={styles.error} role="alert">
                    {error}{" "}
                    {showPlanLink && (
                        <Link href="/pricing">View plan options</Link>
                    )}
                </div>
            )}

            {result?.noResults && (
                <section className={styles.noResults} role="status">
                    <p className={styles.noResultsKicker}>No papers found</p>
                    <h2 className={styles.noResultsTitle}>
                        Nothing I can synthesize yet
                    </h2>
                    <p className={styles.noResultsBody}>
                        {result.message ||
                            "I couldn't find papers for this one. Try a clearer research question — something I can actually look up in the literature."}
                    </p>
                    <blockquote className={styles.questionCard}>
                        <span>Question</span>
                        <p>{result.question}</p>
                    </blockquote>
                </section>
            )}

            {result && !result.noResults && (
                <div className={styles.results}>
                    <header className={styles.reportHeader}>
                        <div>
                            <p className={styles.reportEyebrow}>
                                Topic synthesis
                            </p>
                            <h2 className={styles.reportTitle}>
                                {structuredReport
                                    ? "Gaps, problems, and potential"
                                    : "Evidence synthesis"}
                            </h2>
                        </div>
                        <div className={styles.reportHeaderActions}>
                            {canShareResult && (
                                <button
                                    type="button"
                                    className={styles.shareButton}
                                    onClick={handleShareResult}
                                    disabled={shareStatus === "loading"}
                                >
                                    {shareStatus === "copied"
                                        ? "Link copied!"
                                        : shareStatus === "error"
                                          ? "Share failed"
                                          : shareStatus === "loading"
                                            ? "Sharing…"
                                            : "Share synthesis"}
                                </button>
                            )}
                            <span className={styles.completeBadge}>
                                <span aria-hidden="true">✓</span>{" "}
                                {isLoggedIn ? "Saved" : "Preview complete"}
                            </span>
                        </div>
                    </header>

                    <div className={styles.savedNotice}>
                        {isLoggedIn ? (
                            <span>
                                Saved {new Date(result.createdAt).toLocaleString()}.
                                Paper content will be fetched from its source when
                                you open it.
                            </span>
                        ) : (
                            <span>
                                Guest previews are not saved. Create an account to
                                keep future topic syntheses.
                            </span>
                        )}
                        {isLoggedIn ? (
                            <Link href="/savedpapers?tab=syntheses">
                                View Research Library
                            </Link>
                        ) : (
                            <Link href="/signup">Create an account</Link>
                        )}
                    </div>

                    <blockquote className={styles.questionCard}>
                        <span>Question</span>
                        <p>{result.question}</p>
                    </blockquote>

                    <div className={styles.reportLayout}>
                        <main className={styles.briefSection}>
                            <div className={styles.sectionHeading}>
                                <div>
                                    <p className={styles.sectionKicker}>
                                        Analysis
                                    </p>
                                    <h2 className={styles.sectionTitle}>
                                        {structuredReport
                                            ? "What the science leaves open"
                                            : "What the evidence says"}
                                    </h2>
                                </div>
                                <span className={styles.sectionCount}>
                                    {structuredReport
                                        ? `${reportSectionCount(structuredReport)} sections`
                                        : `${briefSections.length} sections`}
                                </span>
                            </div>
                            {structuredReport ? (
                                <OpportunityReportView
                                    report={structuredReport}
                                    paperCount={result.papers.length}
                                    isLoggedIn={isLoggedIn}
                                    sourceDiscoveryId={
                                        canShareResult ? result.id : undefined
                                    }
                                    activePaperIndex={previewPaperIndex}
                                    onCitePaper={openPaperPreview}
                                    onGuestUpgrade={() => {
                                        setUpgradeExhausted(guestExhausted);
                                        setUpgradeOpen(true);
                                    }}
                                />
                            ) : (
                                <div className={styles.briefGrid}>
                                    {briefSections.map(
                                        (briefSection, index) => (
                                            <article
                                                className={clsx(
                                                    styles.briefCard,
                                                    {
                                                        [styles.primaryBriefCard]:
                                                            index === 0,
                                                    },
                                                )}
                                                key={`${briefSection.title}-${index}`}
                                            >
                                                <div
                                                    className={
                                                        styles.briefCardHeader
                                                    }
                                                >
                                                    <span>
                                                        {String(
                                                            index + 1,
                                                        ).padStart(2, "0")}
                                                    </span>
                                                    <h3>
                                                        {briefSection.title}
                                                    </h3>
                                                </div>
                                                <div className={styles.brief}>
                                                    <Markdown
                                                        components={
                                                            markdownComponents
                                                        }
                                                    >
                                                        {linkPaperReferences(
                                                            briefSection.content,
                                                            result.papers
                                                                .length,
                                                        )}
                                                    </Markdown>
                                                </div>
                                            </article>
                                        ),
                                    )}
                                </div>
                            )}
                        </main>

                        <aside className={styles.evidenceRail}>
                            <div className={styles.evidenceCard}>
                                <p className={styles.sectionKicker}>
                                    Evidence snapshot
                                </p>
                                <div className={styles.metric}>
                                    <strong>{result.meta.papersUsed}</strong>
                                    <span>Papers synthesized</span>
                                    {evidenceMix ? (
                                        <p className={styles.evidenceMix}>
                                            {evidenceMix}
                                        </p>
                                    ) : null}
                                </div>
                                <div className={styles.metricDivider} />
                                <div className={styles.metric}>
                                    <strong>
                                        {result.meta.springerEligibleCount}
                                    </strong>
                                    <span>Eligible Springer results</span>
                                </div>
                                {(result.meta.nihEligibleCount ??
                                    result.meta.nihFillCount) > 0 && (
                                    <>
                                        <div className={styles.metricDivider} />
                                        <div className={styles.metric}>
                                            <strong>
                                                {result.meta.nihEligibleCount ??
                                                    result.meta.nihFillCount}
                                            </strong>
                                            <span>Eligible NIH PMC results</span>
                                        </div>
                                    </>
                                )}
                                {(result.meta.scholarEligibleCount ?? 0) >
                                    0 && (
                                    <>
                                        <div className={styles.metricDivider} />
                                        <div className={styles.metric}>
                                            <strong>
                                                {result.meta.scholarEligibleCount}
                                            </strong>
                                            <span>
                                                Eligible Google Scholar results
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className={styles.methodNote}>
                                <span aria-hidden="true">i</span>
                                <p>
                                    Click a citation to see the excerpt and
                                    evidence type used from that paper. AI
                                    output may be inaccurate and is not medical
                                    advice.
                                </p>
                            </div>
                        </aside>
                    </div>
                    <div ref={analysisEndRef} aria-hidden="true" />

                    <section className={styles.papersSection}>
                        <div className={styles.sectionHeading}>
                            <div>
                                <p className={styles.sectionKicker}>Sources</p>
                                <h2 className={styles.sectionTitle}>
                                    {structuredReport
                                        ? "Papers behind this report"
                                        : "Papers behind this brief"}
                                </h2>
                            </div>
                            <p className={styles.metaLine}>
                                {sourceMixLabel(result)}
                                {result.meta.correctedQuery
                                    ? ` · Search corrected to “${result.meta.correctedQuery}”`
                                    : ""}
                            </p>
                        </div>
                        <ul className={styles.paperList}>
                            {result.papers.map((paper) => {
                                const extraction = extractionForPaper(
                                    result.extractions,
                                    paper.index,
                                );
                                return (
                                <li
                                    key={`${paper.database}-${paper.paperId}`}
                                    id={`discover-paper-${paper.index}`}
                                    className={clsx(styles.paperItem, {
                                        [styles.paperItemHighlighted]:
                                            highlightedPaper === paper.index,
                                    })}
                                >
                                    <div className={styles.paperHeader}>
                                        <span className={styles.paperNumber}>
                                            {String(paper.index).padStart(2, "0")}
                                        </span>
                                        <span
                                            className={clsx(
                                                styles.sourceBadge,
                                                paper.database === "springer"
                                                    ? styles.springerBadge
                                                    : paper.database ===
                                                        "scholar"
                                                      ? styles.scholarBadge
                                                      : styles.nihBadge,
                                            )}
                                        >
                                            {paper.sourceLabel}
                                        </span>
                                        {extraction?.evidenceType ? (
                                            <span
                                                className={clsx(
                                                    styles.evidenceBadge,
                                                    evidenceBadgeClass(
                                                        extraction.evidenceType,
                                                    ),
                                                )}
                                            >
                                                {evidenceTypeLabel(
                                                    extraction.evidenceType,
                                                )}
                                            </span>
                                        ) : null}
                                    </div>
                                    <h3 className={styles.paperTitle}>
                                        <button
                                            type="button"
                                            className={styles.paperTitleButton}
                                            aria-haspopup="dialog"
                                            aria-expanded={
                                                previewPaperIndex ===
                                                paper.index
                                            }
                                            onClick={(event) =>
                                                openPaperPreview(
                                                    paper.index,
                                                    event.currentTarget,
                                                )
                                            }
                                        >
                                            {paper.title}
                                        </button>
                                    </h3>
                                    <p className={styles.paperMeta}>
                                        {paper.authors.slice(0, 3).join(", ")}
                                        {paper.authors.length > 3 ? " et al." : ""}
                                        {paper.date ? ` · ${paper.date}` : ""}
                                    </p>
                                    <div className={styles.paperActions}>
                                        <Link
                                            href={buildPaperFocusHref(
                                                paper.href,
                                                extraction?.methods ||
                                                    extraction?.supportingExcerpt,
                                            )}
                                            className={styles.openPaper}
                                        >
                                            Show method{" "}
                                            <span aria-hidden="true">→</span>
                                        </Link>
                                        {paper.sourceUrl && (
                                            <a
                                                href={paper.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.externalLink}
                                            >
                                                View source ↗
                                            </a>
                                        )}
                                    </div>
                                </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>
            )}
            {previewPaper ? (
                <PaperPreviewDrawer
                    paper={previewPaper}
                    papers={result?.papers ?? []}
                    extraction={previewExtraction}
                    onClose={closePaperPreview}
                    onSelectPaper={openPaperPreview}
                    onSeeInSources={seePaperInSources}
                />
            ) : null}
            {upgradeOpen ? (
                <GuestUpgradeModal
                    open
                    exhausted={upgradeExhausted}
                    canContinueReading={Boolean(result)}
                    onClose={() => setUpgradeOpen(false)}
                />
            ) : null}
        </div>
    );
}

export default DiscoverClient;
