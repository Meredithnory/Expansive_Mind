// app/api/aichat/route.ts
import { NextResponse, NextRequest } from "next/server";
import { respondToMessage } from "../general-chat";
import { withAuth } from "../authMiddleware";
import SavedPaper from "../../models/SavedPaper";
import Message from "../../models/Message";
import {
    getSourceByDatabase,
    normalizeStoredPaperId,
} from "../../lib/paper-sources";
import { findSavedPaperForUser } from "../../lib/saved-paper-utils";
import { loadCachedPaperBySource } from "../paper/load-paper";
import { consumeRateLimit } from "../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../lib/request-security";
import { consumeQuota, resolvePlan } from "../../lib/entitlements";
import { isAdminUser } from "../../lib/admin";

export const POST = withAuth(async (request: NextRequest) => {
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }
        const parsedBody = await readLimitedJsonBody(request, 32 * 1024);
        if (!parsedBody.ok) {
            return NextResponse.json(
                {
                    error:
                        parsedBody.status === 413
                            ? "Chat request is too large."
                            : "A valid chat request is required.",
                },
                { status: parsedBody.status },
            );
        }
        const data = parsedBody.value as Record<string, unknown>;
        const messageForAI =
            typeof data.userResponse === "string"
                ? data.userResponse.trim()
                : "";
        const displayMessage =
            typeof data.displayMessage === "string"
                ? data.displayMessage.trim().slice(0, 8_000)
                : "";
        const database =
            typeof data.database === "string" ? data.database : "";
        const paperId =
            typeof data.paperId === "string" ? data.paperId.trim() : "";
        const sourceConfig = getSourceByDatabase(database);
        const idName =
            typeof data.idName === "string" && data.idName.trim()
                ? data.idName.trim()
                : sourceConfig?.defaultIdName;
        const userID = request.user._id;
        const rateLimit = await consumeRateLimit({
            scope: "chat",
            identity: userID.toString(),
            limit: 10,
            windowMs: 10 * 60 * 1_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many chat requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        if (
            !messageForAI ||
            messageForAI.length > 2_000 ||
            !sourceConfig ||
            !paperId ||
            paperId.length > 300 ||
            !idName
        ) {
            return NextResponse.json(
                {
                    error: "A valid paper reference and question are required.",
                },
                { status: 400 },
            );
        }

        const plan = resolvePlan(request.user);
        const isAdmin = isAdminUser(request.user);
        const quota = await consumeQuota({
            plan,
            feature: "chat",
            identity: userID.toString(),
            userID: userID.toString(),
            unlimited: isAdmin,
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

        const normalizedPaperId = normalizeStoredPaperId(paperId);
        const { value: serverPaper } = await loadCachedPaperBySource(
            sourceConfig.database,
            normalizedPaperId,
            idName,
        );
        if (!serverPaper) {
            return NextResponse.json(
                { error: "Paper not found." },
                { status: 404 },
            );
        }
        if (
            !serverPaper.access.canSendToAI ||
            !serverPaper.access.canPersistContent
        ) {
            return NextResponse.json(
                { error: serverPaper.access.policyReason },
                { status: 403 },
            );
        }

        let foundOrCreatedPaper = await findSavedPaperForUser({
            userID,
            primarySource: sourceConfig.label,
            paperId: normalizedPaperId,
            idName,
        });
        if (!foundOrCreatedPaper && plan === "free" && !isAdmin) {
            const savedPaperCount = await SavedPaper.countDocuments({ userID });
            if (savedPaperCount >= 10) {
                return NextResponse.json(
                    {
                        error: "Free accounts can save up to 10 papers. Upgrade to save more.",
                        code: "QUOTA_EXCEEDED",
                    },
                    { status: 429 },
                );
            }
        }

        const storedHistory = (foundOrCreatedPaper
            ? await Message.find({ savedPaperID: foundOrCreatedPaper._id })
                  .sort({ createdAt: -1 })
                  .limit(12)
                  .lean()
            : []) as unknown as Array<{ sender: string; message: string }>;
        const chatHistory = storedHistory
            .reverse()
            .map((message) => ({
                sender: message.sender,
                message: String(message.message || "").slice(0, 2_000),
            }));

        const messageBackFromAI = await respondToMessage(
            messageForAI,
            serverPaper,
            chatHistory,
            { feature: "chat", userID: userID.toString() },
        );

        if (!messageBackFromAI) {
            return NextResponse.json(
                { error: "The AI did not return a response." },
                { status: 502 },
            );
        }

        if (!foundOrCreatedPaper) {
            foundOrCreatedPaper = await SavedPaper.findOneAndUpdate(
                {
                    userID,
                    primarySource: sourceConfig.label,
                    paperId: normalizedPaperId,
                    idName,
                },
                {
                    $setOnInsert: {
                        userID,
                        primarySource: sourceConfig.label,
                        paperId: normalizedPaperId,
                        idName,
                    },
                },
                { new: true, upsert: true },
            );
        }

        const [, savedAiMessage] = await Message.create([
            {
                savedPaperID: foundOrCreatedPaper._id,
                sender: "user",
                message: displayMessage || messageForAI,
            },
            {
                savedPaperID: foundOrCreatedPaper._id,
                sender: "ai",
                message: messageBackFromAI,
            },
        ]);

        const aiResponse = {
            id: savedAiMessage._id,
            sender: "ai",
            message: savedAiMessage.message,
            timestamp: savedAiMessage.createdAt,
        };

        return NextResponse.json(
            { aiResponse, quota },
            {
                status: 200,
                headers: { "Cache-Control": "private, no-store" },
            },
        );
    } catch (error) {
        console.error("AI chat request failed", error);
        return NextResponse.json(
            { error: "The research assistant is unavailable." },
            { status: 500 },
        );
    }
});
