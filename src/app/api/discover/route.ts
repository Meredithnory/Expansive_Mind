import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth, withOptionalAuth } from "../authMiddleware";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import { hasValidMutationOrigin } from "../../lib/request-security";
import SavedDiscovery from "../../models/SavedDiscovery";
import { DiscoverAgentError, runDiscoverAgent } from "./agent";
import {
    consumeQuota,
    getQuotaSnapshot,
    refundQuota,
    resolvePlan,
    type Plan,
} from "../../lib/entitlements";
import {
    cached,
    getCachedValue,
    setCachedValue,
} from "../../lib/provider-cache";
import { deferUsageRecording } from "../../lib/usage-meter";
import { isAdminUser } from "../../lib/admin";

export const maxDuration = 120;

export const GET = withOptionalAuth(async (request: NextRequest) => {
    try {
        const userID = request.user?._id?.toString();
        const plan = resolvePlan(request.user);
        const identity = userID || requestIp(request);
        const quotas = await getQuotaSnapshot({
            plan,
            identity,
            userID,
            unlimited: isAdminUser(request.user),
        });

        if (!request.user) {
            const lastGuestDiscovery = await getCachedValue(
                "guest-discovery-last",
                identity,
            );
            return NextResponse.json(
                {
                    discoveries: lastGuestDiscovery ? [lastGuestDiscovery] : [],
                    plan,
                    quota: quotas.discover,
                    quotas,
                },
                { headers: { "Cache-Control": "private, no-store" } },
            );
        }

        const discoveries = await SavedDiscovery.find({
            userID: request.user._id,
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return NextResponse.json(
            {
                discoveries: discoveries.map((discovery: any) => ({
                    id: discovery._id.toString(),
                    question: discovery.question,
                    brief: discovery.brief,
                    report: discovery.report,
                    papers: discovery.papers,
                    extractions: discovery.extractions,
                    meta: discovery.meta,
                    createdAt: discovery.createdAt,
                })),
                plan,
                quota: quotas.discover,
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        console.error("Saved discoveries request failed", error);
        return NextResponse.json(
            { error: "Unable to load saved discoveries." },
            { status: 500 },
        );
    }
});

export const POST = withOptionalAuth(async (request: NextRequest) => {
    let reservation: { plan: Plan; identity: string } | null = null;
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const userID = request.user?._id?.toString();
        const identity = userID || requestIp(request);
        const plan = resolvePlan(request.user);
        const rateLimit = await consumeRateLimit({
            scope: "discover",
            identity,
            limit: plan === "guest" ? 2 : 5,
            windowMs: 10 * 60 * 1_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: "Too many discovery requests. Please try again later.",
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const data = await request.json();
        const question =
            typeof data.question === "string" ? data.question.trim() : "";

        if (!question || question.length > 2_000) {
            return NextResponse.json(
                { error: "A research question of 1–2000 characters is required." },
                { status: 400 },
            );
        }

        const quota = await consumeQuota({
            plan,
            feature: "discover",
            identity,
            userID,
            unlimited: isAdminUser(request.user),
        });
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error:
                        plan === "guest"
                            ? "Your free Discovery preview has been used. Create an account and upgrade to Researcher Pro to continue."
                            : plan === "free"
                              ? "Your two free Discovery runs have been used. Upgrade to Researcher Pro to continue."
                              : "Monthly Discovery limit reached.",
                    code: "QUOTA_EXCEEDED",
                    quota,
                },
                { status: 429 },
            );
        }
        reservation = { plan, identity };

        const usageContext = {
            feature: "discover" as const,
            userID,
            anonymousId: userID ? undefined : identity,
        };
        const discovery = await cached({
            namespace: "discovery-v4",
            key: question.toLowerCase().replace(/\s+/g, " ").trim(),
            ttlSeconds: 24 * 60 * 60,
            load: () => runDiscoverAgent(question, usageContext),
        });
        const result = discovery.value;
        if (!discovery.cacheHit) {
            deferUsageRecording({
                context: usageContext,
                provider: "literature_apis",
                operation: "discovery_retrieval",
                callCount: 12,
            });
        }
        const savedDiscovery = request.user
            ? await SavedDiscovery.create({
                  userID: request.user._id,
                  question: result.question,
                  brief: result.brief,
                  papers: result.papers,
                  meta: result.meta,
                  ...(result.report ? { report: result.report } : {}),
                  ...(result.extractions?.length
                      ? { extractions: result.extractions }
                      : {}),
              })
            : null;
        reservation = null;
        const createdAt = savedDiscovery?.createdAt ?? new Date();
        const payload = {
            ...result,
            id:
                savedDiscovery?._id.toString() ??
                `guest-${createdAt.getTime()}`,
            createdAt:
                createdAt instanceof Date
                    ? createdAt.toISOString()
                    : createdAt,
            plan,
            quota,
            cacheHit: discovery.cacheHit,
        };
        if (!request.user) {
            await setCachedValue(
                "guest-discovery-last",
                identity,
                payload,
                24 * 60 * 60,
            );
        }

        return NextResponse.json(payload, {
            status: 200,
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) {
        if (reservation) {
            await refundQuota({
                plan: reservation.plan,
                feature: "discover",
                identity: reservation.identity,
            }).catch((refundError) =>
                console.warn("Discovery quota refund failed", refundError),
            );
        }
        if (error instanceof DiscoverAgentError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }
        console.error("Discover agent request failed", error);
        return NextResponse.json(
            { error: "Discovery is temporarily unavailable." },
            { status: 500 },
        );
    }
});

export const DELETE = withAuth(async (request: NextRequest) => {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const data = await request.json();
        const id = typeof data.id === "string" ? data.id : "";
        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json(
                { error: "A valid discovery ID is required." },
                { status: 400 },
            );
        }

        const deleted = await SavedDiscovery.findOneAndDelete({
            _id: id,
            userID: request.user._id,
        });
        if (!deleted) {
            return NextResponse.json(
                { error: "Discovery not found." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            { success: true },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        console.error("Delete discovery request failed", error);
        return NextResponse.json(
            { error: "Unable to delete this discovery." },
            { status: 500 },
        );
    }
});
