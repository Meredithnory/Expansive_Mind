import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../../authMiddleware";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { consumeRateLimit } from "../../../../lib/rate-limit";
import { deferUsageRecording } from "../../../../lib/usage-meter";
import {
    consumeQuota,
    refundQuota,
    resolvePlan,
    type Plan,
} from "../../../../lib/entitlements";
import { isAdminUser } from "../../../../lib/admin";
import Project from "../../../../models/Project";
import SavedDiscovery from "../../../../models/SavedDiscovery";
import { extractionsFromDiscovery } from "../../discovery-source";
import { generateProjectBriefing } from "../../generate-briefing";
import { serializeProject } from "../../serialize";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 120;

export async function POST(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        let reservation: { plan: Plan; identity: string } | null = null;
        try {
            if (!hasValidMutationOrigin(req)) {
                return NextResponse.json(
                    { error: "Invalid origin." },
                    { status: 403 },
                );
            }

            const { id } = await context.params;
            if (!mongoose.isValidObjectId(id)) {
                return NextResponse.json(
                    { error: "A valid project ID is required." },
                    { status: 400 },
                );
            }

            const userID = req.user._id.toString();
            const rateLimit = await consumeRateLimit({
                scope: "project-research",
                identity: userID,
                limit: 6,
                windowMs: 10 * 60 * 1_000,
            });
            if (!rateLimit.allowed) {
                return NextResponse.json(
                    {
                        error: "Too many research requests. Please try again later.",
                    },
                    {
                        status: 429,
                        headers: {
                            "Retry-After": String(rateLimit.retryAfterSeconds),
                        },
                    },
                );
            }

            const project = await Project.findOne({
                _id: id,
                userID: req.user._id,
            });
            if (!project) {
                return NextResponse.json(
                    { error: "Project not found." },
                    { status: 404 },
                );
            }

            const plan = resolvePlan(req.user);
            const quota = await consumeQuota({
                plan,
                feature: "chat",
                identity: userID,
                userID,
                unlimited: isAdminUser(req.user),
            });
            if (!quota.allowed) {
                return NextResponse.json(
                    {
                        error:
                            plan === "free"
                                ? "Free AI question limit reached. Upgrade to Researcher Pro to continue."
                                : "Monthly AI question limit reached.",
                        code: "QUOTA_EXCEEDED",
                        quota,
                    },
                    { status: 429 },
                );
            }
            reservation = isAdminUser(req.user)
                ? null
                : { plan, identity: userID };

            let extractions = undefined;
            const discoveryId = project.sourceDiscoveryID?.toString();
            if (discoveryId) {
                const discovery = await SavedDiscovery.findOne({
                    _id: discoveryId,
                    userID: req.user._id,
                }).lean<{
                    question?: string;
                    extractions?: unknown;
                    report?: unknown;
                }>();
                extractions = discovery
                    ? extractionsFromDiscovery(discovery)
                    : undefined;
            }

            const usageContext = {
                feature: "projects" as const,
                userID,
            };
            const researched = await generateProjectBriefing(
                {
                    gap: {
                        title: project.gap.title,
                        description: project.gap.description,
                        whyItMatters: project.gap.whyItMatters ?? undefined,
                        citations: project.gap.citations ?? [],
                        confidence: project.gap.confidence ?? undefined,
                    },
                    papers: (project.papers ?? []).map((paper) => ({
                        index: paper.index,
                        title: paper.title,
                        authors: paper.authors,
                        date: paper.date,
                        sourceLabel: paper.sourceLabel,
                    })),
                    extractions,
                },
                usageContext,
            );

            project.set("briefing", researched.briefing);
            await project.save();
            reservation = null;

            deferUsageRecording({
                context: usageContext,
                provider: "app",
                operation: "project_research",
                metadata: { usedFallback: researched.usedFallback },
            });

            return NextResponse.json(
                {
                    project: serializeProject(project.toObject() as any),
                    quota,
                },
                { headers: { "Cache-Control": "private, no-store" } },
            );
        } catch (error) {
            if (reservation) {
                await refundQuota({
                    plan: reservation.plan,
                    feature: "chat",
                    identity: reservation.identity,
                }).catch((refundError) =>
                    console.warn(
                        "Project research quota refund failed",
                        refundError,
                    ),
                );
            }
            console.error("Project research request failed", error);
            return NextResponse.json(
                { error: "Unable to research this project." },
                { status: 500 },
            );
        }
    })(request);
}
