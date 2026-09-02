import { NextResponse, NextRequest } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import Message from "../../models/Message";
import {
    getSourceByDatabase,
    SourceDatabase,
} from "./sources";
import { normalizeStoredPaperId } from "../../lib/paper-sources";
import { findSavedPaperForUser } from "../../lib/saved-paper-utils";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import { deferUsageRecording } from "../../lib/usage-meter";
import { resolvePlan } from "../../lib/entitlements";
import { isAdminUser } from "../../lib/admin";
import { loadCachedPaperBySource } from "./load-paper";
import { consumeGuestDailyCap } from "../../lib/guest-cost-cap";

export const GET = withOptionalAuth(async (request: NextRequest) => {
    const requestStartedAt = performance.now();
    const timings: string[] = [];
    const measure = (name: string, startedAt: number) => {
        timings.push(`${name};dur=${(performance.now() - startedAt).toFixed(1)}`);
    };
    try {
        const database = request.nextUrl.searchParams.get("database");
        const paperId = request.nextUrl.searchParams.get("paperId");
        const idName = request.nextUrl.searchParams.get("idName") || undefined;

        if (
            !database ||
            database.length > 30 ||
            !paperId ||
            paperId.length > 300 ||
            (idName && idName.length > 50)
        ) {
            return NextResponse.json(
                {
                    error: "A valid paper reference is required.",
                },
                { status: 400 }
            );
        }

        const identity = request.user?._id?.toString() || requestIp(request);
        const rateLimitStartedAt = performance.now();
        const rateLimit = await consumeRateLimit({
            scope: "paper",
            identity,
            limit: request.user ? 60 : 6,
            windowMs: 60_000,
        });
        measure("rate_limit", rateLimitStartedAt);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many paper requests. Please try again shortly." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const sourceConfig = getSourceByDatabase(database);
        if (!sourceConfig) {
            return NextResponse.json(
                { error: `Unsupported database: ${database}` },
                { status: 400 }
            );
        }

        if (!request.user) {
            const dailyCap = await consumeGuestDailyCap(request, "paper");
            if (!dailyCap.allowed) {
                return NextResponse.json(
                    {
                        error:
                            "That's the guest paper limit for today. Create an account to keep reading.",
                        code: "DAILY_CAP_REACHED",
                    },
                    {
                        status: 429,
                        headers: {
                            "Retry-After": String(
                                dailyCap.retryAfterSeconds,
                            ),
                        },
                    },
                );
            }
        }

        interface MessageInterface {
            id: string;
            sender: string;
            message: string;
            timestamp: Date;
        }
        let messages: MessageInterface[] = [];

        const paperLoadStartedAt = performance.now();
        const paperResult = await loadCachedPaperBySource(
            database as SourceDatabase,
            paperId,
            idName,
        );
        measure("paper_load", paperLoadStartedAt);
        const paper = paperResult.value;

        if (!paper) {
            return NextResponse.json(
                { error: "Paper not found." },
                { status: 404 }
            );
        }

        const normalizedPaperId = normalizeStoredPaperId(paperId);
        const resolvedIdName = idName || sourceConfig.defaultIdName;

        const savedPaperStartedAt = performance.now();
        const foundSavedPaper = request.user
            ? await findSavedPaperForUser({
                  userID: request.user._id,
                  primarySource: sourceConfig.label,
                  paperId: normalizedPaperId,
                  idName: resolvedIdName,
              })
            : null;
        measure("saved_paper", savedPaperStartedAt);

        if (!paperResult.cacheHit) {
            deferUsageRecording({
                context: {
                    feature: "paper",
                    userID: request.user?._id?.toString(),
                    anonymousId: request.user ? undefined : identity,
                },
                provider: database,
                operation: "paper_detail",
                callCount: database === "nih" ? 3 : 1,
            });
        }

        if (foundSavedPaper && paper.access.canSendToAI) {
            const historyStartedAt = performance.now();
            const allMessages = await Message.find({
                savedPaperID: foundSavedPaper._id,
            })
                .sort({ createdAt: -1 })
                .limit(50)
                .select({ _id: 1, sender: 1, message: 1, createdAt: 1 })
                .lean<
                    Array<{
                        _id: unknown;
                        sender: string;
                        message: string;
                        createdAt: Date;
                    }>
                >();
            messages = allMessages.reverse().map((message) => ({
                id: String(message._id),
                sender: message.sender,
                message: message.message,
                timestamp: message.createdAt,
            }));
            measure("chat_history", historyStartedAt);
        }

        measure("total", requestStartedAt);
        return NextResponse.json(
            {
                paper,
                messages,
                authenticated: Boolean(request.user),
                plan: resolvePlan(request.user),
                canAnalyzeFigures:
                    resolvePlan(request.user) === "pro" ||
                    isAdminUser(request.user),
                cacheHit: paperResult.cacheHit,
            },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                    "Server-Timing": timings.join(", "),
                },
            },
        );
    } catch {
        console.error("Paper request failed");
        return NextResponse.json(
            { error: "Unable to load this paper." },
            { status: 500 }
        );
    }
});
