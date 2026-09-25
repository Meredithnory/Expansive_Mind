"use client";
import DiscoveryPaperChat from "./DiscoveryPaperChat";

import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import clsx from "clsx";
import styles from "./discover.module.scss";
import posthog from "posthog-js";
import { useSession } from "../lib/use-session";
import {
    parseGuestDiscoveryResult,
    parseGuestOpportunityReport,
    readGuestDiscoveryResult,
    writeGuestDiscoveryResult,
    clearGuestDiscoveryResult,
} from "../lib/guest-discovery";
import type {
    OpportunityReport,
    PaperExtraction,
} from "../api/discover/report-types";
import DatabaseMind, {
    type SearchableMindSource,
} from "../components/DatabaseMind";
import PaperImpactBadge from "../components/PaperImpactBadge";
import {
    extractionForPaper,
    yearRangeLabel,
} from "../lib/evidence-type";
import { designMixLabel, paperDesignLabel } from "../lib/claim-evidence";
import { buildPaperFocusHref } from "../lib/paper-sources";
import {
    CONFIDENCE_GUIDE,
    GROUNDING_NOTE,
    reportOutline,
    reportSectionAnchor,
} from "./report-sections";
import {
    discoveryDisplayTitle,
    spellingGateDecision,
} from "../lib/query-quality";
import { fetchDiscoveryQueryAssessment } from "../lib/discover-suggest";
import { searchQueriesMatch } from "../lib/search-suggest";
import { useDiscoveryQuerySuggestion } from "../lib/use-discovery-query-suggestion";
import { useSpeechToText } from "../lib/use-speech-to-text";

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
const ReportRoadmap = dynamic(() => import("./ReportRoadmap"));
const PaperPreviewDrawer = dynamic(() => import("./PaperPreviewDrawer"));
const FounderReportView = dynamic(() => import("./FounderReportView"));

const handoffHandledQueries = new Set<string>();

type DiscoveryQuota = {
    limit: number | null;
    used: number;
    remaining: number | null;
    unlimited?: boolean;
};

type DiscoverPaper = {
    index: number;
    database: "nih" | "springer" | "scholar";
    paperId: string;
    idName: string;
    title: string;
    authors: string[];
    date: string;
    sourceLabel: string;
    sourceUrl: string;
    href: string;
    doi?: string;
    indexedBy?: string[];
    citationCount?: number;
    citationSource?: "crossref" | "europepmc" | "scholar";
    scholarCitesId?: string;
};

type DiscoverResponse = {
    id: string;
    createdAt: string;
    question: string;
    papers: DiscoverPaper[];
    brief: string;
    report?: OpportunityReport;
    extractions?: PaperExtraction[];
    plan?: "guest" | "free" | "pro";
    quota?: DiscoveryQuota;
    meta: {
        springerCandidateCount: number;
        springerEligibleCount: number;
        nihFillCount: number;
        papersUsed: number;
        usedNihFill: boolean;
        usedScholar?: boolean;
        nihCandidateCount?: number;
        nihEligibleCount?: number;
        scholarCandidateCount?: number;
        scholarEligibleCount?: number;
        correctedQuery?: string;
        subQueriesUsed?: string[];
        extractionFailureCount?: number;
        additionalIndexes?: import("../api/discover/additional-indexes").IndexSearchStatus[];
    };
};

type AgentStep =
    | "idle"
    | "expanding"
    | "searching"
    | "reading"
    | "extracting"
    | "analyzing"
    | "composing"
    | "done";

const STEP_COPY: Record<Exclude<AgentStep, "idle" | "done">, string> = {
    expanding: "Expanding your question into targeted searches…",
    searching: "Searching Springer Nature, NIH PMC, Google Scholar, Europe PMC, and Crossref…",
    reading: "Reading licensed paper excerpts…",
    extracting: "Extracting findings, methods, and limitations…",
    analyzing: "Analyzing gaps and contradictions…",
    composing: "Composing the opportunity report…",
};

const AGENT_STEPS: Array<{
    id: Exclude<AgentStep, "idle" | "done">;
    label: string;
}> = [
    { id: "expanding", label: "Expanding your question" },
    { id: "searching", label: "Searching literature" },
    { id: "reading", label: "Reading papers" },
    { id: "extracting", label: "Extracting findings" },
    { id: "analyzing", label: "Analyzing gaps" },
    { id: "composing", label: "Composing report" },
];

const STEP_ORDER: Record<AgentStep, number> = {
    idle: -1,
    expanding: 0,
    searching: 1,
    reading: 2,
    extracting: 3,
    analyzing: 4,
    composing: 5,
    done: 6,
};

const EXAMPLE_QUESTIONS = [
    "What limits CAR-T cell persistence and efficacy in solid tumors?",
    "How do gut microbiome metabolites influence Parkinson's disease progression?",
    "What barriers remain for in vivo base editing delivery beyond the liver?",
    "Do senolytic therapies improve outcomes in age-related pulmonary fibrosis?",
];

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
    const match = href.match(/#?discover-paper-(\d+)\b/i);
    return match ? Number.parseInt(match[1], 10) : null;
}

function isAbortError(error: unknown) {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
    );
}

type DiscoverClientProps = {
    qParam: string;
    savedParam: string;
    hero?: ReactNode;
    modeChrome?: ReactNode;
};

function DiscoverClient({
    qParam,
    savedParam,
    hero,
    modeChrome,
}: DiscoverClientProps) {
    const router = useRouter();
    const {
        isLoggedIn,
        loading: sessionLoading,
        refresh,
    } = useSession();

    const [question, setQuestion] = useState(qParam);
    const [founderScope, setFounderScope] = useState("");
    const [reportTab, setReportTab] = useState<{ id: string; tab: "science" | "opportunity" } | null>(null);
    const [step, setStep] = useState<AgentStep>("idle");
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollLockRef = useRef<{ page: number; windowY: number } | null>(
        null,
    );
    const discoveryAbortRef = useRef<AbortController | null>(null);
    const discoveryCancelledRef = useRef(false);
    const [discarding, setDiscarding] = useState(false);
    const [spellingCheck, setSpellingCheck] = useState<"idle" | "checking">(
        "idle",
    );
    const [exampleIndex, setExampleIndex] = useState(0);
    const [spellingPrompt, setSpellingPrompt] = useState<{
        question: string;
        suggestion: string;
    } | null>(null);
    const [composerMode, setComposerMode] = useState<"discover" | "paper">(
        "discover",
    );
    const [dockedComposerOpen, setDockedComposerOpen] = useState(false);
    const [paperChatOpen, setPaperChatOpen] = useState(false);
    const [selectedPaperIndex, setSelectedPaperIndex] = useState<
        number | undefined
    >();
    const [pendingPaperQuestion, setPendingPaperQuestion] = useState<
        string | null
    >(null);
    const [mindSource, setMindSource] = useState<"all" | SearchableMindSource>(
        "all",
    );
    const [handoffPrompt, setHandoffPrompt] = useState<string | null>(null);
    const composerLauncherRef = useRef<HTMLButtonElement>(null);

    const isRunning = step !== "idle" && step !== "done";
    const isCheckingSpelling = spellingCheck === "checking";
    const { assessment: queryAssessment, assessedQuery, clearAssessment } =
        useDiscoveryQuerySuggestion(question, {
            enabled: !isRunning && composerMode === "discover",
        });
    const speech = useSpeechToText({
        enabled: !isRunning,
        onFinal: (transcript) => {
            setQuestion((current) =>
                [current.trim(), transcript].filter(Boolean).join(" "),
            );
            if (error) setError(null);
            if (spellingPrompt) setSpellingPrompt(null);
        },
    });

    useEffect(() => {
        setComposerMode("discover");
        setDockedComposerOpen(false);
        setPaperChatOpen(false);
        setPendingPaperQuestion(null);
        setSelectedPaperIndex(result?.papers[0]?.index);
    }, [result?.id, result?.papers[0]?.index]);

    const closeDockedComposer = useCallback(() => {
        setDockedComposerOpen(false);
        window.requestAnimationFrame(() => {
            composerLauncherRef.current?.focus();
        });
    }, []);

    const openDockedComposer = useCallback(() => {
        setDockedComposerOpen(true);
        window.requestAnimationFrame(() => {
            textareaRef.current?.focus();
        });
    }, []);

    // Keep the docked composer clear of the shared footer (and mobile bottom nav).
    useEffect(() => {
        if (!result) {
            document.documentElement.style.removeProperty(
                "--discover-composer-bottom",
            );
            return;
        }

        const footer = document.querySelector<HTMLElement>("[data-app-footer]");
        if (!footer) return;

        const syncClearance = () => {
            const top = footer.getBoundingClientRect().top;
            const clearance = Math.max(
                12,
                Math.round(window.innerHeight - top + 10),
            );
            document.documentElement.style.setProperty(
                "--discover-composer-bottom",
                `${clearance}px`,
            );
        };

        syncClearance();
        const observer = new ResizeObserver(syncClearance);
        observer.observe(footer);
        window.addEventListener("resize", syncClearance);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", syncClearance);
            document.documentElement.style.removeProperty(
                "--discover-composer-bottom",
            );
        };
    }, [result?.id]);

    useEffect(() => {
        if (!result || !dockedComposerOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            closeDockedComposer();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [result, dockedComposerOpen, closeDockedComposer]);
    const queryUnclear =
        queryAssessment.status === "unclear" &&
        Boolean(assessedQuery) &&
        searchQueriesMatch(question, assessedQuery ?? "");
    const querySuggestion =
        queryAssessment.status === "corrected" &&
        queryAssessment.suggestion &&
        assessedQuery &&
        searchQueriesMatch(question, assessedQuery)
            ? queryAssessment.suggestion
            : null;

    const applyExample = useCallback((example: string) => {
        setQuestion(example);
        window.requestAnimationFrame(() => {
            const field = textareaRef.current;
            if (!field) return;
            field.focus();
            field.setSelectionRange(field.value.length, field.value.length);
        });
    }, []);

    const scrollToSection = useCallback((anchor: string) => {
        const target = document.getElementById(anchor);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

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
        if (highlightedPaper === null) return;
        const timer = window.setTimeout(
            () => setHighlightedPaper(null),
            2_200,
        );
        return () => window.clearTimeout(timer);
    }, [highlightedPaper]);

    const guestExhausted =
        !sessionLoading &&
        !isLoggedIn &&
        discoveryQuota?.remaining === 0;
    const guestLimit = discoveryQuota?.limit ?? 1;

    const openGuestUpgrade = useCallback((exhausted: boolean) => {
        setUpgradeExhausted(exhausted);
        setUpgradeOpen(true);
    }, []);

    useEffect(() => {
        if (question.trim() || result || isRunning || guestExhausted) return;

        const interval = window.setInterval(() => {
            setExampleIndex((current) => (current + 1) % EXAMPLE_QUESTIONS.length);
        }, 3600);

        return () => window.clearInterval(interval);
    }, [guestExhausted, isRunning, question, result]);

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

    const activeReportTab = reportTab?.id === result?.id && structuredReport?.founder
        ? reportTab?.tab ?? "science"
        : "science";

    const briefSections = useMemo(
        () =>
            result && !structuredReport
                ? parseBriefSections(result.brief)
                : [],
        [result, structuredReport],
    );

    const outline = useMemo(
        () => (structuredReport ? reportOutline(structuredReport) : []),
        [structuredReport],
    );

    const captureScroll = useCallback(() => {
        scrollLockRef.current = {
            page: pageRef.current?.scrollTop ?? 0,
            windowY: window.scrollY,
        };
    }, []);

    const restoreScroll = useCallback(() => {
        const saved = scrollLockRef.current;
        if (!saved) return;
        if (pageRef.current) pageRef.current.scrollTop = saved.page;
        window.scrollTo({ top: saved.windowY, left: 0, behavior: "instant" });
    }, []);

    const scrollToPaper = useCallback((paperIndex: number) => {
        const target = document.getElementById(
            `discover-paper-${paperIndex}`,
        );
        if (!target) return;
        setHighlightedPaper(paperIndex);
        target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, []);

    const openPaperPreview = useCallback(
        (paperIndex: number, trigger?: HTMLElement | null) => {
            const exists = result?.papers.some(
                (paper) => paper.index === paperIndex,
            );
            if (!exists) return;
            if (isLoggedIn) {
                setPreviewPaperIndex(null);
                setSelectedPaperIndex(paperIndex);
                setComposerMode("paper");
                setDockedComposerOpen(true);
                setPaperChatOpen(true);
                setSpellingPrompt(null);
                clearAssessment();
                window.requestAnimationFrame(() => {
                    textareaRef.current?.focus();
                });
                return;
            }
            captureScroll();
            if (trigger) citeTriggerRef.current = trigger;
            setPreviewPaperIndex(paperIndex);
        },
        [captureScroll, clearAssessment, isLoggedIn, result],
    );
    const activePaperIndex =
        isLoggedIn && paperChatOpen
            ? (selectedPaperIndex ?? null)
            : previewPaperIndex;

    const closePaperPreview = useCallback(() => {
        captureScroll();
        setPreviewPaperIndex(null);
        const trigger = citeTriggerRef.current;
        window.requestAnimationFrame(() => {
            trigger?.focus({ preventScroll: true });
            restoreScroll();
        });
    }, [captureScroll, restoreScroll]);

    useLayoutEffect(() => {
        restoreScroll();
    }, [previewPaperIndex, restoreScroll]);

    const seePaperInSources = useCallback(
        (paperIndex: number) => {
            citeTriggerRef.current = null;
            scrollLockRef.current = null;
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
        const mix = designMixLabel(result.extractions);
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
                                    activePaperIndex === paperIndex,
                            })}
                            aria-haspopup="dialog"
                            aria-expanded={activePaperIndex === paperIndex}
                            aria-pressed={activePaperIndex === paperIndex}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openPaperPreview(
                                    paperIndex,
                                    event.currentTarget,
                                );
                            }}
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
        [activePaperIndex, openPaperPreview],
    );

    const restoreGuestBrief = useCallback(() => {
        const stored = readGuestDiscoveryResult();
        if (!stored) return false;
        setResult(stored as DiscoverResponse);
        setStep("done");
        return true;
    }, []);

    const cancelDiscovery = useCallback(() => {
        if (!isRunning) return;
        discoveryCancelledRef.current = true;
        discoveryAbortRef.current?.abort();
    }, [isRunning]);

    const discardDiscovery = useCallback(async () => {
        if (!result || discarding) return;
        const confirmed = window.confirm(
            "Discard this discovery? It will be removed from this page and, if saved, from your library.",
        );
        if (!confirmed) return;
        setDiscarding(true);
        try {
            if (isLoggedIn && /^[a-f0-9]{24}$/i.test(result.id)) {
                const response = await fetch("/api/discover", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: result.id }),
                });
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(
                        typeof data.error === "string"
                            ? data.error
                            : "Unable to discard this discovery.",
                    );
                }
                setSavedDiscoveries((previous) =>
                    previous.filter((discovery) => discovery.id !== result.id),
                );
                void refresh();
            }
            clearGuestDiscoveryResult();
            setResult(null);
            setError(null);
            setPreviewPaperIndex(null);
            setHighlightedPaper(null);
            setStep("idle");
            if (qParam || savedParam) {
                router.replace("/discover");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to discard this discovery.",
            );
        } finally {
            setDiscarding(false);
        }
    }, [
        discarding,
        isLoggedIn,
        qParam,
        refresh,
        result,
        router,
        savedParam,
    ]);

    const runDiscovery = useCallback(
        async (eventOrQuestion?: React.FormEvent | string, scope = "") => {
            if (eventOrQuestion && typeof eventOrQuestion !== "string") {
                eventOrQuestion.preventDefault();
            }
            const trimmed = (
                typeof eventOrQuestion === "string"
                    ? eventOrQuestion
                    : question
            ).trim();
            if (!trimmed || isRunning || isCheckingSpelling) return;
            if (!isLoggedIn && discoveryQuota?.remaining === 0) {
                openGuestUpgrade(true);
                restoreGuestBrief();
                return;
            }

            setError(null);
            setShowPlanLink(false);
            // Keep the current brief visible while a follow-up discovery runs.
            if (!result) setResult(null);
            setStep("expanding");
            discoveryCancelledRef.current = false;
            discoveryAbortRef.current?.abort();
            const controller = new AbortController();
            discoveryAbortRef.current = controller;

            const timers = [
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
                    body: JSON.stringify({ question: trimmed, founderScope: scope }),
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (discoveryCancelledRef.current) {
                    setStep(result ? "done" : "idle");
                    return;
                }
                if (isLoggedIn) void refresh();
                if (!response.ok) {
                    const blocked =
                        data.code === "QUOTA_EXCEEDED" ||
                        data.code === "UPGRADE_REQUIRED";
                    setShowPlanLink(blocked);
                    if (!isLoggedIn && blocked) {
                        setDiscoveryQuota(data.quota ?? discoveryQuota);
                        openGuestUpgrade(true);
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
                clearAssessment();
                setHighlightedPaper(null);
                setPreviewPaperIndex(null);
                setStep("done");
                posthog.capture("discovery_completed", {
                    papers_used: data.meta?.papersUsed,
                    cache_hit: Boolean(data.cacheHit),
                });
            } catch (err) {
                if (
                    discoveryCancelledRef.current ||
                    isAbortError(err)
                ) {
                    setError(null);
                    setStep(result ? "done" : "idle");
                    return;
                }
                setError(
                    err instanceof Error
                        ? err.message
                        : "Discovery is temporarily unavailable.",
                );
                setStep("idle");
            } finally {
                timers.forEach((timer) => window.clearTimeout(timer));
                if (discoveryAbortRef.current === controller) {
                    discoveryAbortRef.current = null;
                }
            }
        },
        [
            clearAssessment,
            discoveryQuota,
            isCheckingSpelling,
            isLoggedIn,
            isRunning,
            openGuestUpgrade,
            question,
            refresh,
            restoreGuestBrief,
            result,
        ],
    );

    const confirmSpellingThenDiscover = useCallback(
        async (eventOrQuestion?: React.FormEvent | string) => {
            if (eventOrQuestion && typeof eventOrQuestion !== "string") {
                eventOrQuestion.preventDefault();
            }
            const trimmed = (
                typeof eventOrQuestion === "string"
                    ? eventOrQuestion
                    : question
            ).trim();
            if (!trimmed || isRunning || isCheckingSpelling) return;
            if (!isLoggedIn && discoveryQuota?.remaining === 0) {
                openGuestUpgrade(true);
                restoreGuestBrief();
                return;
            }

            setError(null);
            setShowPlanLink(false);
            setSpellingPrompt(null);
            setSpellingCheck("checking");

            let nextQuestion = trimmed;
            let shouldRun = true;
            try {
                const readyAssessment =
                    assessedQuery &&
                    searchQueriesMatch(assessedQuery, trimmed)
                        ? queryAssessment
                        : null;
                const assessment =
                    readyAssessment ??
                    (await fetchDiscoveryQueryAssessment(trimmed));
                const decision = spellingGateDecision(assessment);

                if (decision === "block") {
                    setError(
                        "This doesn't look like a research question. Check the spelling or try a clearer biomedical topic.",
                    );
                    shouldRun = false;
                } else if (
                    decision === "confirm" &&
                    assessment?.suggestion
                ) {
                    setSpellingPrompt({
                        question: trimmed,
                        suggestion: assessment.suggestion,
                    });
                    if (!searchQueriesMatch(question, trimmed)) {
                        setQuestion(trimmed);
                    }
                    shouldRun = false;
                }
            } catch {
                nextQuestion = trimmed;
            } finally {
                setSpellingCheck("idle");
            }

            if (shouldRun) {
                void runDiscovery(nextQuestion);
            }
        },
        [
            assessedQuery,
            discoveryQuota,
            isCheckingSpelling,
            isLoggedIn,
            isRunning,
            openGuestUpgrade,
            queryAssessment,
            question,
            restoreGuestBrief,
            runDiscovery,
        ],
    );

    const acceptSpellingSuggestion = useCallback(() => {
        if (!spellingPrompt || isRunning || isCheckingSpelling) return;
        const next = spellingPrompt.suggestion;
        setQuestion(next);
        setSpellingPrompt(null);
        clearAssessment();
        void runDiscovery(next);
    }, [
        clearAssessment,
        isCheckingSpelling,
        isRunning,
        runDiscovery,
        spellingPrompt,
    ]);

    const searchAsWritten = useCallback(() => {
        if (!spellingPrompt || isRunning || isCheckingSpelling) return;
        const original = spellingPrompt.question;
        setSpellingPrompt(null);
        void runDiscovery(original);
    }, [isCheckingSpelling, isRunning, runDiscovery, spellingPrompt]);

    const confirmHandoffDiscovery = useCallback(() => {
        const query = handoffPrompt?.trim();
        if (!query || isRunning || isCheckingSpelling) return;
        handoffHandledQueries.add(query);
        setHandoffPrompt(null);
        void confirmSpellingThenDiscover(query);
    }, [
        confirmSpellingThenDiscover,
        handoffPrompt,
        isCheckingSpelling,
        isRunning,
    ]);

    const declineHandoffDiscovery = useCallback(() => {
        const query = handoffPrompt?.trim();
        if (query) handoffHandledQueries.add(query);
        setHandoffPrompt(null);
    }, [handoffPrompt]);

    useEffect(() => {
        if (sessionLoading || historyLoading || isRunning || result) return;
        if (savedParam) return;
        const query = qParam.trim();
        if (!query) {
            setHandoffPrompt(null);
            return;
        }
        if (!isLoggedIn && discoveryQuota == null) return;
        if (!isLoggedIn && discoveryQuota?.remaining === 0) return;
        if (handoffHandledQueries.has(query)) return;
        setHandoffPrompt(query);
    }, [
        discoveryQuota,
        historyLoading,
        isLoggedIn,
        isRunning,
        qParam,
        result,
        savedParam,
        sessionLoading,
    ]);

    return (
        <div
            ref={pageRef}
            className={clsx(styles.page, {
                [styles.initialPage]: !result,
                [styles.reportPage]: Boolean(result),
                [styles.reportPageChatOpen]: paperChatOpen,
            })}
            data-discover-page
            data-discover-landing={result ? undefined : "true"}
            data-page-scroll
        >
            {modeChrome ? (
                <div
                    className={clsx(styles.modeChrome, {
                        [styles.modeChromeCompact]: Boolean(result),
                    })}
                >
                    {modeChrome}
                </div>
            ) : null}
            {hero ? (
                <section
                    className={clsx(styles.hero, {
                        [styles.heroCompact]: Boolean(result),
                    })}
                >
                    {hero}
                </section>
            ) : !result ? (
                <h1 className={styles.srOnly}>Discovery</h1>
            ) : null}

            {!sessionLoading && !isLoggedIn && (
                guestExhausted ? (
                    <div className={styles.quotaLine} role="status">
                        <p className={styles.quotaMessage}>
                            Guest Discovery limit reached.
                        </p>
                        <button
                            type="button"
                            className={styles.quotaUnlock}
                            onClick={() => openGuestUpgrade(true)}
                        >
                            Unlock Researcher Pro monthly
                        </button>
                    </div>
                ) : (
                    <p className={styles.quotaLine} role="status">
                        {`${discoveryQuota?.remaining ?? guestLimit} of ${guestLimit} guest Discovery left on this network`}
                    </p>
                )
            )}

            {handoffPrompt && !isRunning && !result ? (
                <div
                    className={styles.handoffPrompt}
                    role="dialog"
                    aria-labelledby="discover-handoff-title"
                    aria-describedby="discover-handoff-question"
                >
                    <p
                        id="discover-handoff-title"
                        className={styles.handoffTitle}
                    >
                        Run Discovery with this question?
                    </p>
                    <p
                        id="discover-handoff-question"
                        className={styles.handoffQuestion}
                    >
                        {handoffPrompt}
                    </p>
                    <div className={styles.handoffActions}>
                        <button
                            type="button"
                            className={styles.handoffDecline}
                            onClick={declineHandoffDiscovery}
                        >
                            Not now
                        </button>
                        <button
                            type="button"
                            className={styles.handoffConfirm}
                            onClick={confirmHandoffDiscovery}
                            disabled={isCheckingSpelling}
                        >
                            Run discovery
                        </button>
                    </div>
                </div>
            ) : null}

            {result && !isRunning && !dockedComposerOpen ? (
                <button
                    ref={composerLauncherRef}
                    type="button"
                    className={styles.composerLauncher}
                    aria-expanded={false}
                    aria-controls="discover-docked-composer"
                    onClick={openDockedComposer}
                >
                    <span className={styles.composerLauncherIcon} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path
                                fill="currentColor"
                                d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9.4l-3.7 3.2a.75.75 0 0 1-1.2-.6V16A2.5 2.5 0 0 1 4 13.5v-8Zm2.5-.5a.5.5 0 0 0-.5.5v8c0 .28.22.5.5.5H7.8a1 1 0 0 1 1 1v1.35L11.05 15H17.5a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11Z"
                            />
                        </svg>
                    </span>
                    <span className={styles.composerLauncherLabel}>
                        Ask another question
                    </span>
                </button>
            ) : null}

            {!isRunning && (!result || dockedComposerOpen) && (
            <form
                id={result ? "discover-docked-composer" : undefined}
                className={clsx(styles.form, {
                    [styles.dockedForm]: Boolean(result),
                    [styles.composerForm]: Boolean(result),
                })}
                onSubmit={(event) => {
                    if (composerMode === "paper") {
                        event.preventDefault();
                        const trimmed = question.trim();
                        if (!trimmed || selectedPaperIndex === undefined) return;
                        speech.stop();
                        setPaperChatOpen(true);
                        setPendingPaperQuestion(trimmed);
                        setQuestion("");
                        clearAssessment();
                        return;
                    }
                    speech.stop();
                    const trimmedQuestion = question.trim();
                    if (trimmedQuestion) {
                        handoffHandledQueries.add(trimmedQuestion);
                    }
                    if (qParam.trim()) {
                        handoffHandledQueries.add(qParam.trim());
                    }
                    setHandoffPrompt(null);
                    void confirmSpellingThenDiscover(event);
                }}
            >
                {result ? (
                    <div className={styles.dockedComposerChrome}>
                        <p className={styles.dockedComposerTitle}>
                            {composerMode === "paper"
                                ? "Ask a paper"
                                : "Ask another question"}
                        </p>
                        <button
                            type="button"
                            className={styles.composerClose}
                            aria-label="Close composer"
                            onClick={closeDockedComposer}
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                ) : null}
                <div className={styles.formHeading}>
                    <label
                        className={clsx(styles.label, {
                            [styles.srOnly]: !result,
                        })}
                        htmlFor="discover-question"
                    >
                        {result
                            ? composerMode === "paper"
                                ? "Ask a paper from this report"
                                : "Ask another research question"
                            : "Ask a research question"}
                    </label>
                    <span className={styles.characterCount}>
                        {question.length.toLocaleString()} / 2,000
                    </span>
                </div>
                    <div
                        className={clsx(styles.promptShell, {
                            [styles.promptShellUnclear]:
                                queryUnclear || Boolean(spellingPrompt),
                        })}
                    >
                        {!result && !question.trim() && (
                            <button
                                key={exampleIndex}
                                type="button"
                                className={styles.rotatingExample}
                                onClick={() =>
                                    applyExample(EXAMPLE_QUESTIONS[exampleIndex])
                                }
                                aria-label={`Use example question: ${EXAMPLE_QUESTIONS[exampleIndex]}`}
                            >
                                <span>Try asking</span>
                                {EXAMPLE_QUESTIONS[exampleIndex]}
                            </button>
                        )}
                        <textarea
                            id="discover-question"
                            ref={textareaRef}
                            className={styles.textarea}
                            value={question}
                            onChange={(event) => {
                                setQuestion(event.target.value);
                                if (error) setError(null);
                                if (spellingPrompt) setSpellingPrompt(null);
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key !== "Enter" ||
                                    event.shiftKey ||
                                    event.nativeEvent.isComposing
                                ) {
                                    return;
                                }
                                event.preventDefault();
                                if (
                                    isRunning ||
                                    (composerMode === "discover" &&
                                        isCheckingSpelling) ||
                                    !question.trim() ||
                                    (composerMode === "discover" &&
                                        (queryUnclear || spellingPrompt))
                                ) {
                                    return;
                                }
                                event.currentTarget.form?.requestSubmit();
                            }}
                            aria-describedby="discover-question-feedback discover-voice-status"
                            aria-invalid={
                                composerMode === "discover" &&
                                (queryUnclear || Boolean(spellingPrompt))
                            }
                            placeholder={
                                result
                                    ? composerMode === "paper"
                                        ? "Ask this paper…"
                                        : "Ask another question…"
                                    : question.trim()
                                      ? "Ask a research question…"
                                      : ""
                            }
                            rows={result ? 1 : 2}
                            maxLength={2000}
                            disabled={
                                isRunning ||
                                (composerMode === "discover" &&
                                    isCheckingSpelling)
                            }
                            spellCheck
                        />
                        <div className={styles.composerBar}>
                            {result && isLoggedIn ? (
                                <div
                                    className={styles.modeSwitch}
                                    role="tablist"
                                    aria-label="Composer mode"
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={composerMode === "discover"}
                                        className={clsx(
                                            styles.modeButton,
                                            composerMode === "discover" &&
                                                styles.modeButtonActive,
                                        )}
                                        onClick={() => {
                                            setComposerMode("discover");
                                            setPaperChatOpen(false);
                                        }}
                                    >
                                        Discover
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={composerMode === "paper"}
                                        aria-controls="discovery-paper-chat"
                                        className={clsx(
                                            styles.modeButton,
                                            composerMode === "paper" &&
                                                styles.modeButtonActive,
                                        )}
                                        onClick={() => {
                                            setComposerMode("paper");
                                            setPaperChatOpen(true);
                                            setSpellingPrompt(null);
                                            clearAssessment();
                                        }}
                                    >
                                        Chat with a paper
                                    </button>
                                </div>
                            ) : null}
                            {result &&
                            isLoggedIn &&
                            composerMode === "paper" ? (
                                <label className={styles.paperSelectLabel}>
                                    <span className={styles.srOnly}>
                                        Paper to discuss
                                    </span>
                                    <select
                                        className={styles.paperSelect}
                                        value={selectedPaperIndex ?? ""}
                                        onChange={(event) => {
                                            const next = Number(event.target.value);
                                            setSelectedPaperIndex(next);
                                            setPaperChatOpen(true);
                                        }}
                                    >
                                        {result.papers.map((paper) => (
                                            <option
                                                key={paper.index}
                                                value={paper.index}
                                            >
                                                Paper {paper.index}: {paper.title}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                            <div className={styles.composerActions}>
                                {speech.supported ? (
                                    <button
                                        type="button"
                                        className={clsx(
                                            styles.voiceButton,
                                            speech.listening &&
                                                styles.voiceListening,
                                        )}
                                        aria-pressed={speech.listening}
                                        aria-busy={speech.transcribing}
                                        aria-label={
                                            speech.transcribing
                                                ? "Transcribing voice input"
                                                : speech.listening
                                                  ? "Stop voice input"
                                                  : "Start voice input"
                                        }
                                        onClick={speech.toggle}
                                        disabled={
                                            isRunning || speech.transcribing
                                        }
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                fill="currentColor"
                                                d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.58A7 7 0 0 0 19 11.5h-2Z"
                                            />
                                        </svg>
                                    </button>
                                ) : null}
                                <button
                                    type="submit"
                                    className={styles.submit}
                                    disabled={
                                        isRunning ||
                                        !question.trim() ||
                                        (composerMode === "discover" &&
                                            (isCheckingSpelling ||
                                                queryUnclear ||
                                                Boolean(spellingPrompt)))
                                    }
                                >
                                    <span>
                                        {isRunning
                                            ? "Working…"
                                            : composerMode === "paper"
                                              ? "Ask paper"
                                              : isCheckingSpelling
                                                ? "Checking spelling…"
                                                : "Run"}
                                    </span>
                                    <span
                                        className={styles.submitIcon}
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div
                        id="discover-question-feedback"
                        className={styles.queryFeedback}
                    >
                        {spellingPrompt ? (
                            <div
                                className={styles.spellingGate}
                                role="alertdialog"
                                aria-labelledby="discover-spelling-title"
                                aria-describedby="discover-spelling-suggestion"
                            >
                                <p
                                    id="discover-spelling-title"
                                    className={styles.spellingGateTitle}
                                >
                                    This looks misspelled
                                </p>
                                <p
                                    id="discover-spelling-suggestion"
                                    className={styles.spellingGateLead}
                                >
                                    Did you mean{" "}
                                    <strong>{spellingPrompt.suggestion}</strong>
                                </p>
                                <div className={styles.spellingGateActions}>
                                    <button
                                        type="button"
                                        className={styles.spellingAccept}
                                        onClick={acceptSpellingSuggestion}
                                    >
                                        Use this spelling
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.spellingKeep}
                                        onClick={searchAsWritten}
                                    >
                                        Search as written
                                    </button>
                                </div>
                            </div>
                        ) : queryUnclear ? (
                            <p className={styles.queryWarning} role="status">
                                <span
                                    className={styles.queryWarningIcon}
                                    aria-hidden="true"
                                >
                                    <svg
                                        viewBox="0 0 16 16"
                                        width="14"
                                        height="14"
                                        fill="none"
                                    >
                                        <circle
                                            cx="8"
                                            cy="8"
                                            r="6.25"
                                            stroke="currentColor"
                                            strokeWidth="1.25"
                                        />
                                        <path
                                            d="M8 5.1v3.4"
                                            stroke="currentColor"
                                            strokeWidth="1.35"
                                            strokeLinecap="round"
                                        />
                                        <circle
                                            cx="8"
                                            cy="11.05"
                                            r="0.7"
                                            fill="currentColor"
                                        />
                                    </svg>
                                </span>
                                <span className={styles.queryWarningText}>
                                    This doesn’t look like a research question.
                                    Check the spelling or try a clearer
                                    biomedical topic.
                                </span>
                            </p>
                        ) : querySuggestion ? (
                            <button
                                type="button"
                                className={styles.didYouMean}
                                onClick={() => {
                                    setQuestion(querySuggestion);
                                    clearAssessment();
                                    textareaRef.current?.focus();
                                }}
                            >
                                Did you mean{" "}
                                <strong>{querySuggestion}</strong>
                            </button>
                        ) : isCheckingSpelling ? (
                            <p className={styles.spellingChecking} role="status">
                                Checking spelling…
                            </p>
                        ) : speech.error ? (
                            <p
                                id="discover-voice-status"
                                className={styles.voiceStatus}
                                role="status"
                            >
                                {speech.error}
                            </p>
                        ) : speech.transcribing ? (
                            <p
                                id="discover-voice-status"
                                className={styles.voiceStatus}
                                role="status"
                            >
                                Transcribing…
                            </p>
                        ) : speech.listening ? (
                            <p
                                id="discover-voice-status"
                                className={styles.voiceStatus}
                                role="status"
                            >
                                {speech.mode === "recorder"
                                    ? "Listening… tap the mic when you’re done"
                                    : "Listening… speak your question"}
                            </p>
                        ) : (
                            <span id="discover-voice-status" hidden />
                        )}
                    </div>
            </form>
            )}

            {!result && !isRunning ? (
                <div className={styles.databaseCatalog}>
                    <DatabaseMind
                        activeSource={mindSource}
                        onSelect={setMindSource}
                    />
                </div>
            ) : null}

            {isRunning && (
                <section
                    className={clsx(styles.answerPreview, {
                        [styles.answerPreviewOverReport]: Boolean(result),
                    })}
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className={styles.progressTop}>
                        <span className={styles.progressPulse} />
                        <div>
                            <p className={styles.previewKicker}>
                                Building your opportunity report
                            </p>
                            <p className={styles.status}>{statusLabel}</p>
                            {question.trim() ? (
                                <p className={styles.runningQuestion}>{question.trim()}</p>
                            ) : null}
                            <p className={styles.progressHint}>
                                Reading literature and primary commercial sources, then preparing research findings and venture comparisons. This can take several minutes; missing evidence will be identified.
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
                    <div className={styles.runningActions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={cancelDiscovery}
                        >
                            Cancel
                        </button>
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

            {result && (
                <div
                    className={clsx(styles.results, {
                        [styles.resultsWithPreview]:
                            previewPaperIndex !== null,
                    })}
                >
                    <header className={styles.reportHeader}>
                        <div className={styles.reportHeaderMain}>
                            <p className={styles.reportEyebrow}>
                                {activeReportTab === "opportunity" ? "Opportunity report" : "Science report"}
                            </p>
                            <h2 className={styles.reportTitle}>
                                {discoveryDisplayTitle(
                                    result.question,
                                    result.meta.correctedQuery,
                                )}
                            </h2>
                            {result.meta.correctedQuery ? (
                                <p
                                    className={styles.spellingNote}
                                    role="status"
                                >
                                    Spelling corrected from “{result.question}”
                                </p>
                            ) : null}
                            <p className={styles.reportSummary}>
                                <span>
                                    {`${result.meta.papersUsed} ${
                                        result.meta.papersUsed === 1
                                            ? "paper"
                                            : "papers"
                                    } read`}
                                </span>
                                {evidenceMix ? <span>{evidenceMix}</span> : null}
                                <span>{sourceMixLabel(result)}</span>
                            </p>
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
                            <button
                                type="button"
                                className={styles.discardButton}
                                onClick={() => void discardDiscovery()}
                                disabled={discarding || isRunning}
                            >
                                {discarding
                                    ? "Discarding…"
                                    : "Discard discovery"}
                            </button>
                            <span className={styles.completeBadge}>
                                <span aria-hidden="true">✓</span>{" "}
                                {isLoggedIn ? "Saved" : "Preview complete"}
                            </span>
                        </div>
                    </header>

                    {structuredReport?.founder && (
                        <div className={styles.reportTabs} role="tablist" aria-label="Discovery reports">
                            {(["science", "opportunity"] as const).map((tab, index) => (
                                <button key={tab} type="button" role="tab" id={`report-tab-${tab}`}
                                    aria-controls={`report-panel-${tab}`} aria-selected={activeReportTab === tab}
                                    tabIndex={activeReportTab === tab ? 0 : -1}
                                    onClick={() => setReportTab({ id: result.id, tab })}
                                    onKeyDown={(event) => {
                                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                                        event.preventDefault();
                                        const next = event.key === "Home" ? "science" : event.key === "End" ? "opportunity" : index === 0 ? "opportunity" : "science";
                                        setReportTab({ id: result.id, tab: next });
                                        document.getElementById(`report-tab-${next}`)?.focus();
                                    }}>
                                    {tab === "science" ? "Science report" : "Opportunity report"}
                                </button>
                            ))}
                        </div>
                    )}
                    <div id="report-panel-science" role={structuredReport?.founder ? "tabpanel" : undefined}
                        aria-labelledby={structuredReport?.founder ? "report-tab-science" : undefined}
                        hidden={activeReportTab !== "science"}>
                    {result.meta.additionalIndexes && <details className={styles.groundingNote}>
                        <summary>Additional research index coverage</summary>
                        <ul>{result.meta.additionalIndexes.map(index => <li key={index.name}>
                            <strong>{index.name}: {index.status === "ok" ? "search completed" : index.status === "partial" ? "partial coverage" : "unavailable"}</strong>
                            {` · ${index.metadataCount} records returned · ${index.candidateCount} unique PMC matches · ${index.eligibleCount} eligible before full-text checks. ${index.note}`}
                        </li>)}</ul>
                    </details>}
                    <aside className={styles.groundingNote}>
                        <div className={styles.groundingHead}>
                            <p className={styles.sectionKicker}>
                                {GROUNDING_NOTE.title}
                            </p>
                            <p className={styles.groundingLead}>
                                {GROUNDING_NOTE.lead}
                            </p>
                        </div>
                        <ul className={styles.groundingList}>
                            {GROUNDING_NOTE.points.map((point) => (
                                <li key={point}>{point}</li>
                            ))}
                        </ul>
                        <p className={styles.groundingFooter}>
                            {GROUNDING_NOTE.footer}
                        </p>
                    </aside>

                    <div className={styles.savedNotice}>
                        {isLoggedIn ? (
                            <span>
                                Saved to your library{" "}
                                {new Date(result.createdAt).toLocaleString()}.
                                Paper content is fetched from its source when
                                you open it.
                            </span>
                        ) : (
                            <span>
                                Guest previews are not saved. Create an account to
                                keep this report and run more.
                            </span>
                        )}
                        {isLoggedIn ? (
                            <Link href="/savedpapers?tab=syntheses">
                                Open Research Library
                            </Link>
                        ) : (
                            <Link href="/signup">Create an account</Link>
                        )}
                    </div>

                    <div className={styles.reportLayout}>
                        {structuredReport ? (
                            <ReportRoadmap report={structuredReport} />
                        ) : null}
                        <main className={styles.briefSection}>
                            {!structuredReport && (
                                <div className={styles.sectionHeading}>
                                    <div>
                                        <p className={styles.sectionKicker}>
                                            Analysis
                                        </p>
                                        <h2 className={styles.sectionTitle}>
                                            What the evidence says
                                        </h2>
                                    </div>
                                    <span className={styles.sectionCount}>
                                        {`${briefSections.length} sections`}
                                    </span>
                                </div>
                            )}
                            {structuredReport ? (
                                <OpportunityReportView
                                    report={structuredReport}
                                    paperCount={result.papers.length}
                                    extractions={result.extractions}
                                    isLoggedIn={isLoggedIn}
                                    sourceDiscoveryId={
                                        canShareResult ? result.id : undefined
                                    }
                                    activePaperIndex={activePaperIndex}
                                    onCitePaper={openPaperPreview}
                                    onGuestUpgrade={() => {
                                        openGuestUpgrade(guestExhausted);
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
                            {outline.length > 0 && (
                                <nav
                                    className={styles.outlineCard}
                                    aria-label="Report sections"
                                >
                                    <p className={styles.sectionKicker}>
                                        In this report
                                    </p>
                                    <ol className={styles.outlineList}>
                                        {outline.map((entry) => {
                                            const anchor = reportSectionAnchor(
                                                entry.id,
                                            );
                                            return (
                                                <li key={entry.id}>
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.outlineLink
                                                        }
                                                        onClick={() =>
                                                            scrollToSection(
                                                                anchor,
                                                            )
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                styles.outlineNumber
                                                            }
                                                        >
                                                            {entry.number}
                                                        </span>
                                                        <span
                                                            className={
                                                                styles.outlineTitle
                                                            }
                                                        >
                                                            {entry.title}
                                                        </span>
                                                        {entry.count ? (
                                                            <span
                                                                className={
                                                                    styles.outlineCount
                                                                }
                                                            >
                                                                {entry.count}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        <li>
                                            <button
                                                type="button"
                                                className={styles.outlineLink}
                                                onClick={() =>
                                                    scrollToSection(
                                                        "discover-sources",
                                                    )
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.outlineNumber
                                                    }
                                                >
                                                    {String(
                                                        outline.length + 1,
                                                    ).padStart(2, "0")}
                                                </span>
                                                <span
                                                    className={
                                                        styles.outlineTitle
                                                    }
                                                >
                                                    Papers cited
                                                </span>
                                                <span
                                                    className={
                                                        styles.outlineCount
                                                    }
                                                >
                                                    {result.papers.length}
                                                </span>
                                            </button>
                                        </li>
                                    </ol>
                                </nav>
                            )}
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
                            {structuredReport && (
                                <div className={styles.legendCard}>
                                    <p className={styles.sectionKicker}>
                                        Reading confidence
                                    </p>
                                    <ul className={styles.legendList}>
                                        {(
                                            [
                                                "established",
                                                "suggested",
                                                "speculative",
                                            ] as const
                                        ).map((level) => (
                                            <li key={level}>
                                                <span
                                                    className={clsx(
                                                        styles.legendDot,
                                                        {
                                                            [styles.legendEstablished]:
                                                                level ===
                                                                "established",
                                                            [styles.legendSuggested]:
                                                                level ===
                                                                "suggested",
                                                            [styles.legendSpeculative]:
                                                                level ===
                                                                "speculative",
                                                        },
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                <span>
                                                    <strong>
                                                        {
                                                            CONFIDENCE_GUIDE[
                                                                level
                                                            ].label
                                                        }
                                                    </strong>
                                                    {
                                                        CONFIDENCE_GUIDE[level]
                                                            .meaning
                                                    }
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className={styles.methodNote}>
                                <span aria-hidden="true">i</span>
                                <p>
                                    Confidence is agreement among selected
                                    papers, not a field-wide finding. Click
                                    Paper N to read the checked passage.
                                    This is not medical or investment advice.
                                </p>
                            </div>
                        </aside>
                    </div>

                    <section
                        id="discover-sources"
                        className={styles.papersSection}
                    >
                        <div className={styles.sectionHeading}>
                            <div>
                                <p className={styles.sectionKicker}>Sources</p>
                                <h2 className={styles.sectionTitle}>
                                    {structuredReport
                                        ? "Papers cited in this report"
                                        : "Papers behind this brief"}
                                </h2>
                                <p className={styles.sectionLead}>
                                    Every Paper N above points here. Open a
                                    paper to read the excerpt we used, or jump
                                    to the method in the full text.
                                </p>
                            </div>
                            <p className={styles.metaLine}>
                                {sourceMixLabel(result)}
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
                                        <PaperImpactBadge
                                            citationCount={paper.citationCount}
                                            citationSource={paper.citationSource}
                                            doi={paper.doi}
                                            scholarCitesId={paper.scholarCitesId}
                                            sourcePaper={{
                                                title: paper.title,
                                                doi: paper.doi,
                                                authors: paper.authors,
                                                year: paper.date,
                                            }}
                                        />
                                        {paper.indexedBy?.length ? <span className={styles.evidenceBadge}>Found via {paper.indexedBy.join(" · ")}</span> : null}
                                        {extraction?.evidenceType ? (
                                            <span
                                                className={clsx(
                                                    styles.evidenceBadge,
                                                    evidenceBadgeClass(
                                                        extraction.evidenceType,
                                                    ),
                                                )}
                                            >
                                                {paperDesignLabel(extraction)}
                                            </span>
                                        ) : null}
                                        {extraction?.includedStudyDesign ? (
                                            <span className={styles.evidenceBadge}>
                                                Includes {extraction.includedStudyDesign} studies
                                            </span>
                                        ) : null}
                                        {extraction?.populationMatch === "indirect" ? (
                                            <span className={styles.evidenceBadge}>
                                                Indirect population
                                            </span>
                                        ) : null}
                                    </div>
                                    <h3 className={styles.paperTitle}>
                                        <button
                                            type="button"
                                            className={styles.paperTitleButton}
                                            aria-haspopup="dialog"
                                            aria-expanded={
                                                activePaperIndex ===
                                                paper.index
                                            }
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                openPaperPreview(
                                                    paper.index,
                                                    event.currentTarget,
                                                );
                                            }}
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
                    {structuredReport?.founder && (
                        <div id="report-panel-opportunity" role="tabpanel" aria-labelledby="report-tab-opportunity"
                            hidden={activeReportTab !== "opportunity"}>
                            <FounderReportView key={result.id} report={structuredReport.founder} />
                            {!guestExhausted && <details className={styles.founderControls}>
                                <summary>Add context and regenerate</summary>
                                <form onSubmit={(event) => { event.preventDefault(); void runDiscovery(result.question, founderScope.trim()); }}>
                                    <label>Geography, budget, or stage
                                        <input type="text" value={founderScope} maxLength={500} disabled={isRunning}
                                            onChange={event => setFounderScope(event.target.value)}
                                            placeholder="US labs · $250k validation budget · idea stage" />
                                    </label>
                                    <button type="submit" className={styles.shareButton} disabled={isRunning || isCheckingSpelling || !founderScope.trim()}>
                                        Regenerate
                                    </button>
                                </form>
                            </details>}
                        </div>
                    )}
                </div>
            )}
            {result && isLoggedIn && (
                <DiscoveryPaperChat
                    key={result.id}
                    papers={result.papers}
                    question={result.question}
                    open={paperChatOpen}
                    selected={selectedPaperIndex}
                    pendingQuestion={pendingPaperQuestion}
                    onPendingQuestionHandled={() => setPendingPaperQuestion(null)}
                    onClose={() => {
                        setPaperChatOpen(false);
                        setComposerMode("discover");
                        textareaRef.current?.focus();
                    }}
                />
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
