"use client";
import DiscoveryPaperChat, { type PaperChatFocus } from "./DiscoveryPaperChat";

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
import { questionChecks } from "../lib/discover-question-checks";
import ClaimLedgerView from "./ClaimLedgerView";
import {
    buildClaimLedger,
    toLedgerExtractions,
    toLedgerPapers,
} from "../api/discover/claim-ledger";
import ShareBriefDialog from "./ShareBriefDialog";
import PaperProvenanceSection from "./PaperProvenanceSection";
import { paperProvenance, type PaperProvenance } from "./paper-provenance";
import PaperImpactBadge from "../components/PaperImpactBadge";
import {
    extractionForPaper,
    yearRangeLabel,
} from "../lib/evidence-type";
import { designMixLabel, paperDesignLabel } from "../lib/claim-evidence";
import {
    citedEvidence,
    evidenceFocusHref,
    methodFocusHref,
    type CiteContext,
} from "../lib/paper-evidence";
import {
    parseReportPaperNumber,
    parseReportView,
    withReportOrigin,
} from "../lib/paper-sources";
import { resolveScholarCitesId } from "../lib/citing-works";
import { CONFIDENCE_GUIDE, GROUNDING_NOTE } from "./report-sections";
import {
    discoveryDisplayTitle,
    spellingGateDecision,
} from "../lib/query-quality";
import { fetchDiscoveryQueryAssessment } from "../lib/discover-suggest";
import { searchQueriesMatch } from "../lib/search-suggest";
import { useDiscoveryQuerySuggestion } from "../lib/use-discovery-query-suggestion";

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
    licenseUrl?: string;
    quoteGate?: import("../lib/quote-eligibility").QuoteGateReason;
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
    searching: "Searching Springer Nature, NIH PMC, Europe PMC, OpenAlex, and Google Scholar…",
    reading: "Reading licensed paper excerpts…",
    extracting: "Extracting findings, methods, and limitations…",
    analyzing: "Analyzing gaps and contradictions…",
    composing: "Composing the opportunity report…",
};

/** What the reader sees while Discovery runs: five plain steps over the
 * agent's six stages. */
const WORKING_STEPS: Array<{
    label: string;
    stages: Array<Exclude<AgentStep, "idle" | "done">>;
}> = [
    { label: "Turning your question into searches", stages: ["expanding"] },
    {
        label: "Searching NIH PMC, Springer Nature, Europe PMC, Crossref",
        stages: ["searching"],
    },
    { label: "Picking the most relevant open-access papers", stages: ["reading"] },
    { label: "Reading and extracting findings, methods, limits", stages: ["extracting"] },
    { label: "Writing your cited report", stages: ["analyzing", "composing"] },
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

type ReportView = "state" | "gaps" | "papers" | "ledger" | "opportunity";

const READS_FROM = [
    { label: "NIH PMC", color: "#0ab1ff" },
    { label: "Springer Nature", color: "#ff5aa9" },
    { label: "Europe PMC", color: "#22a06b" },
    { label: "Crossref", color: "#f5a524" },
    { label: "Google Scholar (Pro)", color: "#8b5cf6" },
];

/** "2026-09-26T…" → "Sep 26". */
function formatShortDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ""
        : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

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
    /** Back from the reader: the report tab, gap, and paper to reopen at. */
    returnView?: string;
    returnGap?: string;
    returnPaper?: string;
    hero?: ReactNode;
    modeChrome?: ReactNode;
};

function DiscoverClient({
    qParam,
    savedParam,
    returnView = "",
    returnGap = "",
    returnPaper = "",
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
    const [reportView, setReportView] = useState<{ id: string; view: ReportView } | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const shareTriggerRef = useRef<HTMLButtonElement>(null);
    const [step, setStep] = useState<AgentStep>("idle");
    const [error, setError] = useState<string | null>(null);
    const [showPlanLink, setShowPlanLink] = useState(false);
    const [result, setResult] = useState<DiscoverResponse | null>(null);
    const [savedDiscoveries, setSavedDiscoveries] = useState<
        DiscoverResponse[]
    >([]);
    const [historyLoading, setHistoryLoading] = useState(true);
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
    // The cited sentence the guest preview opens at, when the chip named one.
    const [previewQuote, setPreviewQuote] = useState<string | null>(null);
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
    const [spellingPrompt, setSpellingPrompt] = useState<{
        question: string;
        suggestion: string;
    } | null>(null);
    const [dockedComposerOpen, setDockedComposerOpen] = useState(false);
    const [paperChatOpen, setPaperChatOpen] = useState(false);
    // Set by a citation click: the passage to highlight and where the panel grows from.
    const [paperChatFocus, setPaperChatFocus] =
        useState<PaperChatFocus | null>(null);
    const [selectedPaperIndex, setSelectedPaperIndex] = useState<
        number | undefined
    >();
    const [handoffPrompt, setHandoffPrompt] = useState<string | null>(null);
    const followUpTriggerRef = useRef<HTMLButtonElement>(null);

    const isRunning = step !== "idle" && step !== "done";
    const isCheckingSpelling = spellingCheck === "checking";
    const { assessment: queryAssessment, assessedQuery, clearAssessment } =
        useDiscoveryQuerySuggestion(question, {
            enabled: !isRunning,
        });

    useEffect(() => {
        setDockedComposerOpen(false);
        setPaperChatOpen(false);
        setSelectedPaperIndex(result?.papers[0]?.index);
    }, [result?.id, result?.papers[0]?.index]);

    const closeDockedComposer = useCallback(() => {
        setDockedComposerOpen(false);
        window.requestAnimationFrame(() => {
            followUpTriggerRef.current?.focus();
        });
    }, []);

    const openDockedComposer = useCallback(() => {
        setDockedComposerOpen(true);
        window.requestAnimationFrame(() => {
            textareaRef.current?.focus();
        });
    }, []);


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
        setShareOpen(false);
        setPreviewPaperIndex(null);
    }, [result?.id]);

    const hasSavedDiscoveryId = Boolean(
        isLoggedIn && result && /^[a-f0-9]{24}$/i.test(result.id),
    );

    const structuredReport = useMemo(() => {
        return (
            parseGuestOpportunityReport(result?.report) ??
            parseGuestOpportunityReport(result?.brief)
        );
    }, [result]);


    const statusLabel = useMemo(() => {
        if (step === "idle" || step === "done") return null;
        return STEP_COPY[step];
    }, [step]);

    // Built like the shared brief's ledger, with the same strict quote gate.
    const claimLedger = useMemo(
        () =>
            structuredReport && result
                ? buildClaimLedger(
                      structuredReport,
                      toLedgerPapers(result.papers),
                      toLedgerExtractions(result.extractions),
                      result.question,
                  )
                : undefined,
        [result, structuredReport],
    );

    // The report reads as tabs: summary, gaps, papers, ledger, opportunity.
    const reportViews = useMemo(() => {
        if (!result) return [] as Array<{ id: ReportView; label: string; short?: string }>;
        const views: Array<{ id: ReportView; label: string; short?: string }> = [
            { id: "state", label: "State of the science", short: "Summary" },
        ];
        const gapCount = structuredReport?.sections.gaps.length ?? 0;
        if (gapCount > 0) views.push({ id: "gaps", label: `Gaps · ${gapCount}` });
        views.push({ id: "papers", label: `Papers · ${result.papers.length}` });
        if (claimLedger?.rows.length) {
            views.push({ id: "ledger", label: "Claim ledger", short: "Ledger" });
        }
        if (structuredReport?.founder) {
            views.push({ id: "opportunity", label: "Opportunity report", short: "Opportunity" });
        }
        return views;
    }, [claimLedger, result, structuredReport]);
    // A report opens on the state of the science. A reader "Your report" link
    // still reopens the tab it came from.
    const defaultReportView: ReportView = "state";
    const activeView: ReportView =
        reportView &&
        reportView.id === result?.id &&
        reportViews.some((view) => view.id === reportView.view)
            ? reportView.view
            : defaultReportView;
    const selectReportView = useCallback(
        (view: ReportView) => {
            if (result) setReportView({ id: result.id, view });
        },
        [result],
    );
    const closeShare = useCallback(() => {
        setShareOpen(false);
        window.requestAnimationFrame(() => shareTriggerRef.current?.focus());
    }, []);

    const briefSections = useMemo(
        () =>
            result && !structuredReport
                ? parseBriefSections(result.brief)
                : [],
        [result, structuredReport],
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

    // The evidence a citation stands on: what the report cited, else the
    // paper's evidence closest to the claim.
    const evidenceFor = useCallback(
        (paperIndex: number, cite: CiteContext) =>
            citedEvidence(
                extractionForPaper(result?.extractions, paperIndex)?.evidence,
                paperIndex,
                cite,
            ),
        [result?.extractions],
    );

    const openPaperPreview = useCallback(
        (paperIndex: number, trigger?: HTMLElement | null, cite?: CiteContext) => {
            const exists = result?.papers.some(
                (paper) => paper.index === paperIndex,
            );
            if (!exists) return;
            const cited = cite ? evidenceFor(paperIndex, cite) : null;
            const citedQuote = cited?.quote ?? null;
            if (trigger) citeTriggerRef.current = trigger;
            if (isLoggedIn) {
                const rect = trigger?.getBoundingClientRect();
                setPaperChatFocus((current) => ({
                    paperIndex,
                    // A paper we can't quote has only the sentence's
                    // fingerprint; the panel finds it in the paper.
                    excerpt:
                        citedQuote ||
                        (cited?.anchor
                            ? ""
                            : extractionForPaper(result?.extractions, paperIndex)
                                  ?.supportingExcerpt || ""),
                    anchor: citedQuote ? null : (cited?.anchor ?? null),
                    citedFor: cited?.finding ?? null,
                    claim: cite?.context || null,
                    requestId: (current?.requestId ?? 0) + 1,
                    origin: rect
                        ? {
                              x: rect.left + rect.width / 2,
                              y: rect.top + rect.height / 2,
                          }
                        : null,
                }));
                setPreviewPaperIndex(null);
                setSelectedPaperIndex(paperIndex);
                setPaperChatOpen(true);
                return;
            }
            captureScroll();
            if (trigger) citeTriggerRef.current = trigger;
            setPreviewQuote(citedQuote);
            setPreviewPaperIndex(paperIndex);
        },
        [captureScroll, evidenceFor, isLoggedIn, result],
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
            if (result) setReportView({ id: result.id, view: "papers" });
            // Two frames: the Papers tab renders, then the paper scrolls in.
            window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => scrollToPaper(paperIndex)),
            );
        },
        [result, scrollToPaper],
    );

    // Back from the reader ("Your report"): reopen the tab it left from, then
    // the gap or paper. Once per report, so later tab clicks stick.
    const returnTarget = parseReportView(returnView);
    const returnGapNumber =
        returnTarget === "gaps" ? parseReportPaperNumber(returnGap) : null;
    const returnAppliedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!result || !returnTarget || returnAppliedRef.current === result.id) return;
        if (!reportViews.some((view) => view.id === returnTarget)) return;
        returnAppliedRef.current = result.id;
        setReportView({ id: result.id, view: returnTarget });
        const paper = parseReportPaperNumber(returnPaper);
        if (returnTarget === "papers" && paper) {
            // Two frames: the Papers tab renders, then the paper scrolls in.
            window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => scrollToPaper(paper)),
            );
        }
    }, [result, returnTarget, returnPaper, reportViews, scrollToPaper]);

    const reportReturn = useMemo(
        () => ({
            report: hasSavedDiscoveryId ? result?.id : null,
            view: activeView,
        }),
        [activeView, hasSavedDiscoveryId, result?.id],
    );

    // Per paper card: PMCID, quote status, and the report claims that cite it.
    const provenanceByPaper = useMemo(() => {
        if (!result) return new Map<number, PaperProvenance>();
        return new Map(
            paperProvenance(
                result.papers,
                structuredReport,
                result.brief,
                result.extractions,
            ).map((row) => [row.index, row]),
        );
    }, [result, structuredReport]);

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

    // Signed in: back to the landing. Guests keep their one saved brief, so
    // they ask again from the docked composer.
    const startNewQuestion = useCallback(() => {
        if (!isLoggedIn) {
            openDockedComposer();
            return;
        }
        setResult(null);
        setError(null);
        setPreviewPaperIndex(null);
        setHighlightedPaper(null);
        setStep("idle");
        setQuestion("");
        clearAssessment();
        if (qParam || savedParam) {
            router.replace("/discover");
        }
        window.requestAnimationFrame(() => textareaRef.current?.focus());
    }, [
        clearAssessment,
        isLoggedIn,
        openDockedComposer,
        qParam,
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

    // The question box: the landing composer before a report, and the
    // "Ask a follow-up" box inside a report (inline; a sheet on phone).
    const composerForm =
        !isRunning && (!result || dockedComposerOpen) ? (
            <form
                id={result ? "discover-follow-up" : undefined}
                className={clsx(styles.form, {
                    [styles.followUpForm]: Boolean(result),
                    [styles.composerForm]: Boolean(result),
                })}
                onSubmit={(event) => {
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
                            Ask a follow-up
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
                            ? "Ask another research question"
                            : "Ask a research question"}
                    </label>
                    {result ? (
                        <span className={styles.characterCount}>
                            {question.length.toLocaleString()} / 2,000
                        </span>
                    ) : null}
                </div>
                    <div
                        className={clsx(styles.promptShell, {
                            [styles.promptShellUnclear]:
                                queryUnclear || Boolean(spellingPrompt),
                        })}
                    >
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
                                    isCheckingSpelling ||
                                    !question.trim() ||
                                    queryUnclear ||
                                    spellingPrompt
                                ) {
                                    return;
                                }
                                event.currentTarget.form?.requestSubmit();
                            }}
                            aria-describedby="discover-question-feedback"
                            aria-invalid={queryUnclear || Boolean(spellingPrompt)}
                            placeholder={
                                result
                                    ? "Ask another research question, building on this report…"
                                    : "Ask a research question…"
                            }
                            rows={result ? 2 : 3}
                            maxLength={2000}
                            disabled={isRunning || isCheckingSpelling}
                            spellCheck
                        />
                        <div className={styles.composerBar}>
                            {!result ? (
                                <div className={styles.landingHints}>
                                    {question.trim() ? (
                                        questionChecks(question).map((check) => (
                                            <span
                                                key={check.id}
                                                className={clsx(
                                                    styles.questionCheck,
                                                    check.ok && styles.questionCheckOk,
                                                )}
                                            >
                                                <span aria-hidden="true">
                                                    {check.ok ? "✓" : "+"}
                                                </span>
                                                {check.label}
                                            </span>
                                        ))
                                    ) : (
                                        <span className={styles.landingTip}>
                                            Tip: name a population, an
                                            intervention, or an outcome.
                                        </span>
                                    )}
                                </div>
                            ) : null}
                            <div className={styles.composerActions}>
                                {!result ? (
                                    <span className={styles.landingCount}>
                                        {question.length.toLocaleString()} / 2,000
                                    </span>
                                ) : (
                                    <span className={styles.followUpNote}>
                                        Runs a new Discovery. Your report stays saved.
                                    </span>
                                )}
                                <button
                                    type="submit"
                                    className={styles.submit}
                                    disabled={
                                        isRunning ||
                                        !question.trim() ||
                                        isCheckingSpelling ||
                                        queryUnclear ||
                                        Boolean(spellingPrompt)
                                    }
                                >
                                    <span>
                                        {isRunning
                                            ? "Working…"
                                            : isCheckingSpelling
                                                ? "Checking spelling…"
                                                : "Run discovery"}
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
                        ) : null}
                    </div>
            </form>
        ) : null;

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
            data-discover-running={isRunning ? "true" : undefined}
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
            ) : !result && !isRunning ? (
                <section className={styles.landingHero}>
                    <h1 className={styles.landingTitle}>
                        What do you want to find out?
                    </h1>
                    <p className={styles.landingLead}>
                        Ask one research question. Get a cited brief:
                        what&apos;s known and where the gaps are.
                    </p>
                </section>
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


            {result ? null : composerForm}

            {!result && !isRunning ? (
                <div className={styles.landingExtras}>
                    {!question.trim() ? (
                        <>
                            <section
                                className={styles.tryAsking}
                                aria-labelledby="discover-try-asking"
                            >
                                <p
                                    id="discover-try-asking"
                                    className={styles.landingLabel}
                                >
                                    Try asking
                                </p>
                                <div className={styles.exampleList}>
                                    {EXAMPLE_QUESTIONS.map((example) => (
                                        <button
                                            key={example}
                                            type="button"
                                            className={styles.exampleChip}
                                            onClick={() => applyExample(example)}
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section
                                className={styles.whatYouGet}
                                aria-labelledby="discover-what-you-get"
                            >
                                <p
                                    id="discover-what-you-get"
                                    className={clsx(
                                        styles.landingLabel,
                                        styles.landingLabelPhone,
                                    )}
                                >
                                    What you&apos;ll get
                                </p>
                                <div className={styles.getCards}>
                                    <div className={styles.getCard}>
                                        <span
                                            className={styles.getCardTitle}
                                            data-tone="pink"
                                        >
                                            1 · State of the science
                                        </span>
                                        <span>
                                            A cited answer to your question,
                                            from open-access papers.
                                        </span>
                                    </div>
                                    <div className={styles.getCard}>
                                        <span
                                            className={styles.getCardTitle}
                                            data-tone="amber"
                                        >
                                            2 · Gaps and problems
                                        </span>
                                        <span>
                                            What&apos;s still open, with how
                                            confident the evidence is.
                                        </span>
                                    </div>
                                </div>
                            </section>
                            {isLoggedIn && savedDiscoveries.length > 0 ? (
                                <section
                                    className={styles.recentList}
                                    aria-labelledby="discover-recent"
                                >
                                    <p
                                        id="discover-recent"
                                        className={clsx(
                                            styles.landingLabel,
                                            styles.landingLabelStart,
                                        )}
                                    >
                                        Pick up where you left off
                                    </p>
                                    {savedDiscoveries.slice(0, 3).map((saved) => (
                                        <Link
                                            key={saved.id}
                                            href={`/discover?saved=${encodeURIComponent(saved.id)}`}
                                            className={styles.recentRow}
                                        >
                                            <span className={styles.recentQuestion}>
                                                {saved.question}
                                            </span>
                                            <span className={styles.recentDate}>
                                                {formatShortDate(saved.createdAt)}
                                            </span>
                                        </Link>
                                    ))}
                                </section>
                            ) : null}
                        </>
                    ) : null}
                    <p className={styles.readsFrom}>
                        <span className={styles.readsFromLabel}>Reads from</span>
                        {READS_FROM.map((source) => (
                            <span key={source.label} className={styles.readsFromSource}>
                                <span
                                    className={styles.readsFromDot}
                                    style={{ background: source.color }}
                                    aria-hidden="true"
                                />
                                {source.label}
                            </span>
                        ))}
                    </p>
                </div>
            ) : null}

            {isRunning && (
                <section
                    className={clsx(styles.working, {
                        [styles.answerPreviewOverReport]: Boolean(result),
                    })}
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className={styles.workingHead}>
                        <span className={styles.workingEyebrow}>
                            Discovery in progress
                        </span>
                        {result ? (
                            <p className={styles.workingTitle}>
                                {question.trim()}
                            </p>
                        ) : (
                            <h1 className={styles.workingTitle}>
                                {question.trim() || "Discovery"}
                            </h1>
                        )}
                        <p className={styles.srOnly}>{statusLabel}</p>
                    </div>
                    <ol className={styles.workingSteps} aria-label="Progress">
                        {WORKING_STEPS.map((workingStep) => {
                            const lastStage = Math.max(
                                ...workingStep.stages.map((stage) => STEP_ORDER[stage]),
                            );
                            const isComplete = STEP_ORDER[step] > lastStage;
                            const isActive = workingStep.stages.some(
                                (stage) => stage === step,
                            );
                            return (
                                <li
                                    key={workingStep.label}
                                    className={styles.workingStep}
                                    data-state={
                                        isComplete ? "done" : isActive ? "active" : "todo"
                                    }
                                    aria-current={isActive ? "step" : undefined}
                                >
                                    <span className={styles.workingDot} aria-hidden="true">
                                        {isComplete ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        ) : isActive ? (
                                            <span className={styles.workingSpinner} />
                                        ) : null}
                                    </span>
                                    <span className={styles.workingLabel}>
                                        {workingStep.label}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                    <div className={styles.workingFoot}>
                        <span>
                            Reading open-access papers. Every claim will link
                            back to its source.
                        </span>
                        <button
                            type="button"
                            className={styles.workingCancel}
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
                    <header className={styles.reportTop}>
                        <div className={styles.reportTopMain}>
                            <p className={styles.reportTopEyebrow}>
                                {[
                                    "Your discovery",
                                    formatShortDate(result.createdAt),
                                    `${result.meta.papersUsed} ${result.meta.papersUsed === 1 ? "paper" : "papers"}`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                            <h1 className={styles.reportTopTitle}>
                                {discoveryDisplayTitle(
                                    result.question,
                                    result.meta.correctedQuery,
                                )}
                            </h1>
                            {result.meta.correctedQuery ? (
                                <p
                                    className={styles.spellingNote}
                                    role="status"
                                >
                                    Spelling corrected from “{result.question}”
                                </p>
                            ) : null}
                        </div>
                        <div className={styles.reportTopActions}>
                            <button
                                ref={followUpTriggerRef}
                                type="button"
                                className={clsx(styles.reportNewQuestion, styles.followUpToggle, {
                                    [styles.followUpToggleOpen]: dockedComposerOpen,
                                })}
                                aria-expanded={dockedComposerOpen}
                                aria-controls="discover-follow-up"
                                onClick={() =>
                                    dockedComposerOpen ? closeDockedComposer() : openDockedComposer()
                                }
                                disabled={isRunning}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M5 5h14v10H10l-4 4v-4H5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                </svg>
                                Ask a follow-up
                            </button>
                            <button
                                type="button"
                                className={styles.reportNewQuestion}
                                onClick={startNewQuestion}
                                disabled={isRunning}
                            >
                                New question
                            </button>
                            {hasSavedDiscoveryId && (
                                <button
                                    ref={shareTriggerRef}
                                    type="button"
                                    className={styles.reportShare}
                                    onClick={() => setShareOpen(true)}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="2" />
                                        <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
                                        <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="2" />
                                        <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    Share brief
                                </button>
                            )}
                        </div>
                    </header>

                    {composerForm ? (
                        <>
                            {/* Phone: the follow-up box is a sheet over a dimmed report. */}
                            <button
                                type="button"
                                className={styles.followUpBackdrop}
                                aria-label="Close"
                                tabIndex={-1}
                                onClick={closeDockedComposer}
                            />
                            {composerForm}
                        </>
                    ) : null}

                    {reportViews.length > 1 && (
                        <div
                            className={styles.reportViewTabs}
                            role="tablist"
                            aria-label="Report sections"
                        >
                            {reportViews.map((view, index) => (
                                <button
                                    key={view.id}
                                    type="button"
                                    role="tab"
                                    id={`report-tab-${view.id}`}
                                    aria-controls={`report-panel-${view.id}`}
                                    aria-selected={activeView === view.id}
                                    tabIndex={activeView === view.id ? 0 : -1}
                                    aria-label={view.label}
                                    className={styles.reportViewTab}
                                    onClick={() => selectReportView(view.id)}
                                    onKeyDown={(event) => {
                                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                                        event.preventDefault();
                                        const last = reportViews.length - 1;
                                        const nextIndex =
                                            event.key === "Home"
                                                ? 0
                                                : event.key === "End"
                                                  ? last
                                                  : event.key === "ArrowLeft"
                                                    ? (index - 1 + reportViews.length) % reportViews.length
                                                    : (index + 1) % reportViews.length;
                                        const next = reportViews[nextIndex].id;
                                        selectReportView(next);
                                        document.getElementById(`report-tab-${next}`)?.focus();
                                    }}
                                >
                                    <span
                                        className={styles.reportViewLong}
                                        aria-hidden="true"
                                    >
                                        {view.label}
                                    </span>
                                    <span
                                        className={styles.reportViewShort}
                                        aria-hidden="true"
                                    >
                                        {view.short ?? view.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div
                        id="report-panel-state"
                        role={reportViews.length > 1 ? "tabpanel" : undefined}
                        aria-labelledby={reportViews.length > 1 ? "report-tab-state" : undefined}
                        hidden={activeView !== "state"}
                        className={styles.reportPanel}
                    >
                        {structuredReport ? (
                            <OpportunityReportView
                                report={structuredReport}
                                paperCount={result.papers.length}
                                papers={result.papers}
                                only={["state", "limits"]}
                                reportView="state"
                                evidenceFor={evidenceFor}
                                isLoggedIn={isLoggedIn}
                                sourceDiscoveryId={
                                    hasSavedDiscoveryId ? result.id : undefined
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
                    </div>

                    {structuredReport && structuredReport.sections.gaps.length > 0 && (
                        <div
                            id="report-panel-gaps"
                            role="tabpanel"
                            aria-labelledby="report-tab-gaps"
                            hidden={activeView !== "gaps"}
                            className={styles.reportPanel}
                        >
                            <OpportunityReportView
                                report={structuredReport}
                                paperCount={result.papers.length}
                                papers={result.papers}
                                only={["gaps", "problems", "experiments", "translation"]}
                                reportView="gaps"
                                evidenceFor={evidenceFor}
                                initialGap={returnGapNumber}
                                isLoggedIn={isLoggedIn}
                                sourceDiscoveryId={
                                    hasSavedDiscoveryId ? result.id : undefined
                                }
                                activePaperIndex={activePaperIndex}
                                onCitePaper={openPaperPreview}
                                onGuestUpgrade={() => {
                                    openGuestUpgrade(guestExhausted);
                                }}
                            />
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
                        </div>
                    )}

                    <div
                        id="report-panel-papers"
                        role={reportViews.length > 1 ? "tabpanel" : undefined}
                        aria-labelledby={reportViews.length > 1 ? "report-tab-papers" : undefined}
                        hidden={activeView !== "papers"}
                        className={styles.reportPanel}
                    >
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
                                {[
                                    `${result.meta.papersUsed} ${result.meta.papersUsed === 1 ? "paper" : "papers"} read`,
                                    evidenceMix,
                                    sourceMixLabel(result),
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
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
                                            scholarCitesId={resolveScholarCitesId(
                                                {
                                                    scholarCitesId:
                                                        paper.scholarCitesId,
                                                    database: paper.database,
                                                    idName: paper.idName,
                                                    paperId: paper.paperId,
                                                },
                                            )}
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
                                    {extraction?.evidence?.length ? (
                                        <div className={styles.paperEvidence}>
                                            <span className={styles.paperEvidenceLabel}>
                                                Evidence used
                                            </span>
                                            <ul>
                                                {extraction.evidence.slice(0, 4).map((item) => (
                                                    <li key={item.id}>
                                                        <Link
                                                            href={withReportOrigin(
                                                                evidenceFocusHref(paper.href, item),
                                                                paper.index,
                                                                null,
                                                                reportReturn,
                                                            )}
                                                        >
                                                            {item.finding}
                                                            <span aria-hidden="true"> →</span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                    {provenanceByPaper.get(paper.index) ? (
                                        <PaperProvenanceSection
                                            paper={paper}
                                            row={provenanceByPaper.get(paper.index) as PaperProvenance}
                                            reportReturn={reportReturn}
                                        />
                                    ) : null}
                                    <div className={styles.paperActions}>
                                        <Link
                                            href={withReportOrigin(
                                                methodFocusHref(
                                                    paper.href,
                                                    extraction?.methodsEvidence,
                                                ),
                                                paper.index,
                                                null,
                                                reportReturn,
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

                    {claimLedger?.rows.length ? (
                        <div
                            id="report-panel-ledger"
                            role="tabpanel"
                            aria-labelledby="report-tab-ledger"
                            hidden={activeView !== "ledger"}
                            className={styles.reportPanel}
                        >
                            <ClaimLedgerView
                                ledger={claimLedger}
                                activePaperIndex={activePaperIndex}
                                onCitePaper={openPaperPreview}
                            />
                        </div>
                    ) : null}

                    {structuredReport?.founder && (
                        <div
                            id="report-panel-opportunity"
                            role="tabpanel"
                            aria-labelledby="report-tab-opportunity"
                            hidden={activeView !== "opportunity"}
                            className={styles.reportPanel}
                        >
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

                    <div className={styles.reportFootNote}>
                        <span>
                            Every claim in this report links to the passage it
                            came from. Open a paper to check it.
                        </span>
                        <button
                            type="button"
                            className={styles.reportFootLink}
                            onClick={() => {
                                selectReportView("papers");
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                        >
                            {`See all ${result.papers.length} ${result.papers.length === 1 ? "paper" : "papers"}`}
                        </button>
                    </div>
                    <p className={styles.reportFine}>
                        Confidence is agreement among selected papers, not a
                        field-wide finding. This is not medical or investment
                        advice. {isLoggedIn ? "Saved to your library." : "Preview only."}{" "}
                        <button
                            type="button"
                            className={styles.reportDiscard}
                            onClick={() => void discardDiscovery()}
                            disabled={discarding || isRunning}
                        >
                            {discarding ? "Discarding…" : "Discard discovery"}
                        </button>
                    </p>
                </div>
            )}
            {shareOpen && result && hasSavedDiscoveryId ? (
                <ShareBriefDialog discoveryId={result.id} onClose={closeShare} />
            ) : null}
            {result && isLoggedIn && (
                <DiscoveryPaperChat
                    key={result.id}
                    papers={result.papers}
                    question={result.question}
                    open={paperChatOpen}
                    selected={selectedPaperIndex}
                    focus={paperChatFocus}
                    returnTo={reportReturn}
                    onSelectPaper={(index) => setSelectedPaperIndex(index)}
                    onClose={() => {
                        setPaperChatOpen(false);
                        // Back to the chip that opened it.
                        const trigger = citeTriggerRef.current;
                        window.requestAnimationFrame(() => trigger?.focus());
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
                    returnTo={reportReturn}
                    citedQuote={previewQuote}
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
