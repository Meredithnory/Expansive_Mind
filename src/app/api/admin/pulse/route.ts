import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import connectDB from "../../../db/connectDB";
import {
    funnelSteps,
    parsePulseRange,
    questionTopics,
} from "../../../lib/admin-pulse";
import { getPlanConfig, resolvePlan } from "../../../lib/plan-config";
import {
    buildClaimLedger,
    isClaimLedgerRowComplete,
    toLedgerExtractions,
    toLedgerPapers,
} from "../../discover/claim-ledger";
import { parseOpportunityReport } from "../../discover/synthesize";
import ContactMessage from "../../../models/ContactMessage";
import ForumReport from "../../../models/ForumReport";
import GuestDiscovery from "../../../models/GuestDiscovery";
import PageEngagement from "../../../models/PageEngagement";
import ProductSignal from "../../../models/ProductSignal";
import SavedDiscovery from "../../../models/SavedDiscovery";
import UsageEvent from "../../../models/UsageEvent";
import User from "../../../models/User";

const DAY_MS = 24 * 60 * 60 * 1_000;
/** Runs read in full for quality checks; enough for a launch-sized product. */
const QUALITY_SAMPLE = 400;
const EXAMPLES = 3;

type Run = {
    _id: unknown;
    userID?: unknown;
    question: string;
    shareSlug?: string;
    createdAt: Date;
    report?: unknown;
    papers?: unknown;
    extractions?: unknown;
    meta?: {
        extractionFailureCount?: number;
        additionalIndexes?: Array<{ status?: string }>;
    };
};

function dayKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

async function costMicros(from: Date, to: Date) {
    const [row] = await UsageEvent.aggregate([
        { $match: { occurredAt: { $gte: from, $lt: to } } },
        { $group: { _id: null, micros: { $sum: "$estimatedCostMicros" } } },
    ]);
    return Number(row?.micros || 0);
}

export const GET = withAdmin(async (request: NextRequest) => {
    await connectDB();
    const range = parsePulseRange(request.nextUrl.searchParams.get("range"));
    const now = new Date();
    const since = new Date(now.getTime() - range * DAY_MS);
    const priorSince = new Date(since.getTime() - range * DAY_MS);
    const today = new Date(`${dayKey(now)}T00:00:00.000Z`);

    const [
        visitors,
        briefVisitors,
        runs,
        priorRuns,
        guestRuns,
        priorGuestRuns,
        sharers,
        newAccounts,
        priorNewAccounts,
        joinedFromBrief,
        paying,
        config,
        cost,
        priorCost,
        costToday,
        signals,
        newMessages,
        openReports,
    ] = await Promise.all([
        PageEngagement.distinct("visitorKey", { day: { $gte: dayKey(since) } }),
        PageEngagement.distinct("visitorKey", {
            day: { $gte: dayKey(since) },
            "secondsByPage.brief": { $gt: 0 },
        }),
        SavedDiscovery.find({ createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .limit(QUALITY_SAMPLE)
            .select("userID question shareSlug createdAt report papers extractions meta")
            .lean<Run[]>(),
        SavedDiscovery.find({ createdAt: { $gte: priorSince, $lt: since } })
            .select("question")
            .lean<Array<{ question: string }>>(),
        GuestDiscovery.find({ createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .select("identityHash question createdAt")
            .lean<Array<{ identityHash: string; question: string; createdAt: Date }>>(),
        GuestDiscovery.find({ createdAt: { $gte: priorSince, $lt: since } })
            .select("question")
            .lean<Array<{ question: string }>>(),
        SavedDiscovery.distinct("userID", { sharedAt: { $gte: since } }),
        User.countDocuments({ submittedAt: { $gte: since } }),
        User.countDocuments({ submittedAt: { $gte: priorSince, $lt: since } }),
        User.countDocuments({ signupSource: "brief", submittedAt: { $gte: since } }),
        User.find({ $or: [{ plan: "pro" }, { accessOverride: "pro" }] })
            .select("plan accessOverride subscriptionStatus")
            .lean<Array<{ plan?: string; accessOverride?: string | null; subscriptionStatus?: string }>>(),
        getPlanConfig(),
        costMicros(since, now),
        costMicros(priorSince, since),
        costMicros(today, now),
        ProductSignal.aggregate([
            { $match: { day: { $gte: dayKey(since) } } },
            { $group: { _id: "$key", count: { $sum: "$count" } } },
        ]),
        ContactMessage.countDocuments({ status: "new" }),
        ForumReport.countDocuments({ resolved: false }),
    ]);

    const ranIdentities = new Set([
        ...runs.map((run) => `user:${String(run.userID)}`),
        ...guestRuns.map((run) => `guest:${run.identityHash}`),
    ]);
    const funnel = funnelSteps([
        { id: "visited", label: "Visited", detail: "People on the site", count: visitors.length },
        { id: "asked", label: "Asked", detail: "Ran a discovery", count: ranIdentities.size },
        { id: "shared", label: "Shared", detail: "Created a share link", count: sharers.length },
        { id: "opened", label: "Opened", detail: "Opened a shared brief", count: briefVisitors.length },
        { id: "joined", label: "Joined", detail: "Signed up from a brief", count: joinedFromBrief },
    ]);

    // What people ask: signed-in and guest questions together.
    const topics = questionTopics(
        [
            ...runs.map((run) => ({ question: run.question, shared: Boolean(run.shareSlug) })),
            ...guestRuns.map((run) => ({ question: run.question, shared: false })),
        ],
        [...priorRuns, ...priorGuestRuns].map((run) => run.question),
    );
    const newest = [
        ...runs.map((run) => ({ question: run.question, createdAt: run.createdAt, userID: run.userID })),
        ...guestRuns.map((run) => ({ question: run.question, createdAt: run.createdAt, userID: null })),
    ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);
    const askers = await User.find({
        _id: { $in: newest.flatMap((item) => (item.userID ? [item.userID] : [])) },
    })
        .select("plan accessOverride subscriptionStatus")
        .lean<Array<{ _id: unknown; plan?: string; accessOverride?: string | null; subscriptionStatus?: string }>>();
    const planById = new Map(
        askers.map((user) => [
            String(user._id),
            resolvePlan({ ...user, accessOverride: user.accessOverride ?? undefined }),
        ]),
    );

    // Where runs fall short.
    let claims = 0;
    let quotedClaims = 0;
    const unquoted: string[] = [];
    const noGaps: string[] = [];
    const failedPapers: string[] = [];
    const sourceDown: string[] = [];
    let noGapCount = 0;
    let failedCount = 0;
    let downCount = 0;
    for (const run of runs) {
        const report = parseOpportunityReport(run.report);
        if (report) {
            const ledger = buildClaimLedger(
                report,
                toLedgerPapers(run.papers),
                toLedgerExtractions(run.extractions),
                run.question,
                { logDecisions: false },
            );
            const quoted = ledger.rows.filter(isClaimLedgerRowComplete).length;
            claims += ledger.rows.length;
            quotedClaims += quoted;
            if (quoted < ledger.rows.length && unquoted.length < EXAMPLES) unquoted.push(run.question);
            if (report.sections.gaps.length === 0) {
                noGapCount += 1;
                if (noGaps.length < EXAMPLES) noGaps.push(run.question);
            }
        }
        if ((run.meta?.extractionFailureCount ?? 0) > 0) {
            failedCount += 1;
            if (failedPapers.length < EXAMPLES) failedPapers.push(run.question);
        }
        if (run.meta?.additionalIndexes?.some((index) => index.status === "unavailable")) {
            downCount += 1;
            if (sourceDown.length < EXAMPLES) sourceDown.push(run.question);
        }
    }
    const signalCount = new Map(
        signals.map((row: { _id: string; count: number }) => [row._id, Number(row.count || 0)]),
    );

    const payingPro = paying.filter(
        (user) => user.plan === "pro" && ["active", "trialing"].includes(user.subscriptionStatus || ""),
    ).length;
    const monthlyPrice = config.prices.month.amount / 100;

    return NextResponse.json(
        {
            range,
            funnel,
            kpis: {
                newAccounts,
                priorNewAccounts,
                proAccounts: paying.length,
                payingPro,
                listValue: payingPro * monthlyPrice,
                aiCostUsd: cost / 1_000_000,
                priorAiCostUsd: priorCost / 1_000_000,
                discoveries: runs.length + guestRuns.length,
            },
            today: {
                aiCostUsd: costToday / 1_000_000,
                newMessages,
                openReports,
            },
            topics,
            newest: newest.map((item) => ({
                question: item.question,
                createdAt: item.createdAt,
                plan: item.userID ? planById.get(String(item.userID)) ?? "free" : "guest",
            })),
            quality: [
                {
                    id: "unquoted",
                    label: "Claims with no quotable passage",
                    detail: "Paper licenses or missing excerpts",
                    value: `${claims - quotedClaims} of ${claims} claims`,
                    examples: unquoted,
                },
                {
                    id: "closest",
                    label: "Citations opened without an exact sentence",
                    detail: `Readers saw the closest match ${signalCount.get("citation_closest_match") ?? 0} times; no match ${signalCount.get("citation_no_match") ?? 0}`,
                    value: `${(signalCount.get("citation_closest_match") ?? 0) + (signalCount.get("citation_no_match") ?? 0)}`,
                    examples: [],
                },
                {
                    id: "failed",
                    label: "Runs with a paper that failed to read",
                    detail: "Extraction failures",
                    value: `${failedCount} ${failedCount === 1 ? "run" : "runs"}`,
                    examples: failedPapers,
                },
                {
                    id: "nogaps",
                    label: "Runs that found no gaps",
                    detail: "The report came back without gaps",
                    value: `${noGapCount} ${noGapCount === 1 ? "run" : "runs"}`,
                    examples: noGaps,
                },
                {
                    id: "down",
                    label: "A source was down during a run",
                    detail: "An extra index was unavailable",
                    value: `${downCount} ${downCount === 1 ? "run" : "runs"}`,
                    examples: sourceDown,
                },
            ],
            sampled: runs.length >= QUALITY_SAMPLE,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
