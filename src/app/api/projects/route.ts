import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../authMiddleware";
import { hasValidMutationOrigin } from "../../lib/request-security";
import { consumeRateLimit } from "../../lib/rate-limit";
import {
    consumeQuota,
    refundQuota,
    resolvePlan,
    type Plan,
} from "../../lib/entitlements";
import { isAdminUser } from "../../lib/admin";
import { deferUsageRecording } from "../../lib/usage-meter";
import Project from "../../models/Project";
import SavedDiscovery from "../../models/SavedDiscovery";
import type {
    PaperExtraction,
    ReportConfidence,
} from "../discover/report-types";
import { generateProjectPlan } from "./generate-plan";
import { generateProjectBriefing } from "./generate-briefing";
import { extractionsFromDiscovery } from "./discovery-source";
import {
    GAP_DESCRIPTION_MAX,
    TITLE_MAX,
    WHY_IT_MATTERS_MAX,
    serializeProject,
    type SerializedProjectPaper,
} from "./serialize";

export const maxDuration = 60;

const CONFIDENCES = new Set<ReportConfidence>([
    "established",
    "suggested",
    "speculative",
]);
const DATABASES = new Set(["nih", "springer", "scholar"]);

function asTrimmedString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asCitations(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) =>
            typeof item === "number"
                ? item
                : typeof item === "string"
                  ? Number.parseInt(item, 10)
                  : NaN,
        )
        .filter((item) => Number.isInteger(item) && item >= 1);
}

function copyPapers(papers: unknown): SerializedProjectPaper[] {
    if (!Array.isArray(papers)) return [];
    const copied: SerializedProjectPaper[] = [];
    for (const raw of papers) {
        if (!raw || typeof raw !== "object") continue;
        const paper = raw as Record<string, unknown>;
        const database = asTrimmedString(paper.database);
        const paperId = asTrimmedString(paper.paperId);
        const title = asTrimmedString(paper.title);
        const href = asTrimmedString(paper.href);
        const idName = asTrimmedString(paper.idName);
        const sourceLabel = asTrimmedString(paper.sourceLabel);
        if (
            !DATABASES.has(database) ||
            !paperId ||
            !title ||
            !href ||
            !idName ||
            !sourceLabel
        ) {
            continue;
        }
        const index =
            typeof paper.index === "number" && paper.index >= 1
                ? paper.index
                : copied.length + 1;
        copied.push({
            index,
            database: database as SerializedProjectPaper["database"],
            paperId,
            idName,
            title,
            authors: Array.isArray(paper.authors)
                ? paper.authors.filter(
                      (author): author is string => typeof author === "string",
                  )
                : [],
            date: asTrimmedString(paper.date),
            sourceLabel,
            sourceUrl: asTrimmedString(paper.sourceUrl),
            href,
            ...(typeof paper.doi === "string" && paper.doi.trim()
                ? { doi: paper.doi.trim() }
                : {}),
        });
    }
    return copied;
}

export const GET = withAuth(async (request: NextRequest) => {
    try {
        const docs = await Project.find({ userID: request.user._id })
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json(
            {
                projects: docs.map((doc) => serializeProject(doc as any)),
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        console.error("List projects request failed", error);
        return NextResponse.json(
            { error: "Unable to load projects." },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (request: NextRequest) => {
    let reservation: { plan: Plan; identity: string } | null = null;
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const userID = request.user._id.toString();
        const plan = resolvePlan(request.user);
        const rateLimit = await consumeRateLimit({
            scope: "projects",
            identity: userID,
            limit: 8,
            windowMs: 10 * 60 * 1_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many project requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const data = await request.json().catch(() => null);
        if (!data || typeof data !== "object") {
            return NextResponse.json(
                { error: "A project title and gap are required." },
                { status: 400 },
            );
        }

        const title = asTrimmedString((data as { title?: unknown }).title);
        if (!title || title.length > TITLE_MAX) {
            return NextResponse.json(
                { error: `A title of 1–${TITLE_MAX} characters is required.` },
                { status: 400 },
            );
        }

        const gapRaw = (data as { gap?: unknown }).gap;
        if (!gapRaw || typeof gapRaw !== "object") {
            return NextResponse.json(
                { error: "A gap with a title and description is required." },
                { status: 400 },
            );
        }
        const gapRecord = gapRaw as Record<string, unknown>;
        const gapTitle = asTrimmedString(gapRecord.title);
        const gapDescription = asTrimmedString(gapRecord.description);
        const whyItMatters = asTrimmedString(gapRecord.whyItMatters);
        if (!gapTitle || gapTitle.length > TITLE_MAX) {
            return NextResponse.json(
                { error: `A gap title of 1–${TITLE_MAX} characters is required.` },
                { status: 400 },
            );
        }
        if (!gapDescription || gapDescription.length > GAP_DESCRIPTION_MAX) {
            return NextResponse.json(
                {
                    error: `A gap description of 1–${GAP_DESCRIPTION_MAX} characters is required.`,
                },
                { status: 400 },
            );
        }
        if (whyItMatters.length > WHY_IT_MATTERS_MAX) {
            return NextResponse.json(
                {
                    error: `whyItMatters must be ${WHY_IT_MATTERS_MAX} characters or fewer.`,
                },
                { status: 400 },
            );
        }

        const confidenceRaw = asTrimmedString(gapRecord.confidence);
        if (confidenceRaw && !CONFIDENCES.has(confidenceRaw as ReportConfidence)) {
            return NextResponse.json(
                { error: "confidence must be established, suggested, or speculative." },
                { status: 400 },
            );
        }

        const gap = {
            title: gapTitle,
            description: gapDescription,
            ...(whyItMatters ? { whyItMatters } : {}),
            citations: asCitations(gapRecord.citations),
            ...(confidenceRaw
                ? { confidence: confidenceRaw as ReportConfidence }
                : {}),
        };

        const sourceDiscoveryId = asTrimmedString(
            (data as { sourceDiscoveryId?: unknown }).sourceDiscoveryId,
        );
        if (sourceDiscoveryId && !mongoose.isValidObjectId(sourceDiscoveryId)) {
            return NextResponse.json(
                { error: "A valid sourceDiscoveryId is required." },
                { status: 400 },
            );
        }

        let papers: SerializedProjectPaper[] = [];
        let extractions: PaperExtraction[] | undefined;
        let question: string | undefined;
        if (sourceDiscoveryId) {
            const discovery = await SavedDiscovery.findOne({
                _id: sourceDiscoveryId,
                userID: request.user._id,
            }).lean<{
                question?: string;
                papers?: unknown;
                report?: unknown;
                extractions?: unknown;
            }>();
            if (!discovery) {
                return NextResponse.json(
                    { error: "Source discovery not found." },
                    { status: 404 },
                );
            }
            papers = copyPapers(discovery.papers);
            extractions = extractionsFromDiscovery(discovery);
            question = asTrimmedString(discovery.question) || undefined;
        }

        const quota = await consumeQuota({
            plan,
            feature: "projects",
            identity: userID,
            userID,
            unlimited: isAdminUser(request.user),
        });
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error:
                        plan === "free"
                            ? "Your free project allowance has been used. Upgrade to Researcher Pro to start more projects."
                            : "Monthly project limit reached.",
                    code: "QUOTA_EXCEEDED",
                    quota,
                },
                { status: 429 },
            );
        }
        reservation = { plan, identity: userID };

        const usageContext = {
            feature: "projects" as const,
            userID,
        };
        const planInput = {
            question,
            gap,
            papers: papers.map((paper) => ({
                index: paper.index,
                title: paper.title,
                authors: paper.authors,
                date: paper.date,
                sourceLabel: paper.sourceLabel,
            })),
            extractions,
        };
        const [generated, researched] = await Promise.all([
            generateProjectPlan(planInput, usageContext),
            generateProjectBriefing(planInput, usageContext),
        ]);

        const created = await Project.create({
            userID: request.user._id,
            title,
            ...(sourceDiscoveryId
                ? { sourceDiscoveryID: sourceDiscoveryId }
                : {}),
            gap,
            papers,
            plan: generated.steps.map((step) => ({
                ...step,
                status: "pending" as const,
            })),
            briefing: researched.briefing,
            notes: "",
        });
        reservation = null;

        deferUsageRecording({
            context: usageContext,
            provider: "app",
            operation: "project_create",
            metadata: {
                usedFallback: generated.usedFallback,
                briefingFallback: researched.usedFallback,
                stepCount: generated.steps.length,
            },
        });

        return NextResponse.json(
            { project: serializeProject(created.toObject() as any) },
            {
                status: 201,
                headers: { "Cache-Control": "private, no-store" },
            },
        );
    } catch (error) {
        if (reservation) {
            await refundQuota({
                plan: reservation.plan,
                feature: "projects",
                identity: reservation.identity,
            }).catch((refundError) =>
                console.warn("Project quota refund failed", refundError),
            );
        }
        console.error("Create project request failed", error);
        return NextResponse.json(
            { error: "Unable to create this project." },
            { status: 500 },
        );
    }
});
