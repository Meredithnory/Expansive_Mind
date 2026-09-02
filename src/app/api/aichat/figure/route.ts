import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { consumeRateLimit } from "../../../lib/rate-limit";
import {
    consumeQuota,
    refundQuota,
    resolvePlan,
} from "../../../lib/entitlements";
import { isAdminUser } from "../../../lib/admin";
import {
    getSourceByDatabase,
    normalizeStoredPaperId,
} from "../../../lib/paper-sources";
import { loadCachedPaperBySource } from "../../paper/load-paper";
import {
    fetchFigureImage,
    figureImageDataUrl,
    MAX_FIGURE_BYTES,
    validateFigureBytes,
} from "../../../lib/figure-image";
import {
    buildFigureContext,
    findPaperFigure,
} from "../../../lib/figure-context";
import { respondToFigure } from "../../figure-chat";
import { findSavedPaperForUser } from "../../../lib/saved-paper-utils";
import SavedPaper from "../../../models/SavedPaper";
import Message from "../../../models/Message";
import {
    FIGURE_RIGHTS_ATTESTATION_VERSION,
    isFigureCaptureMethod,
} from "../../../lib/figure-capture";

const textField = (form: FormData, name: string, max: number) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim().slice(0, max) : "";
};

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const userID = request.user._id.toString();
    const plan = resolvePlan(request.user);
    const isAdmin = isAdminUser(request.user);
    if (plan !== "pro" && !isAdmin) {
        return NextResponse.json(
            {
                error: "Figure analysis is available with Researcher Pro.",
                code: "PRO_REQUIRED",
            },
            { status: 403 },
        );
    }

    const rateLimit = await consumeRateLimit({
        scope: "figure-chat",
        identity: userID,
        limit: 5,
        windowMs: 10 * 60 * 1_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many figure requests. Please try again later." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rateLimit.retryAfterSeconds),
                },
            },
        );
    }

    let quotaConsumed = false;
    try {
        const requestLength = Number(request.headers.get("content-length"));
        if (
            Number.isFinite(requestLength) &&
            requestLength > MAX_FIGURE_BYTES + 256 * 1024
        ) {
            return NextResponse.json(
                { error: "Figure images must be no larger than 5 MB." },
                { status: 413 },
            );
        }
        const form = await request.formData();
        const database = textField(form, "database", 30);
        const paperId = textField(form, "paperId", 300);
        const sourceConfig = getSourceByDatabase(database);
        const idName =
            textField(form, "idName", 50) || sourceConfig?.defaultIdName;
        const figureId = textField(form, "figureId", 300);
        const question =
            textField(form, "question", 2_000) ||
            "Please explain this figure in plain language.";
        const userCaption = textField(form, "caption", 4_000);
        const captureMethod = textField(form, "captureMethod", 30);
        const rightsAttestation = textField(form, "rightsAttestation", 50);
        const upload = form.get("image");
        if (form.getAll("image").length > 1) {
            return NextResponse.json(
                { error: "Upload one figure image at a time." },
                { status: 400 },
            );
        }

        if (!sourceConfig || !paperId || !idName) {
            return NextResponse.json(
                { error: "A valid paper reference is required." },
                { status: 400 },
            );
        }

        const normalizedPaperId = normalizeStoredPaperId(paperId);
        const { value: paper } = await loadCachedPaperBySource(
            sourceConfig.database,
            normalizedPaperId,
            idName,
        );
        if (!paper) {
            return NextResponse.json(
                { error: "Paper not found." },
                { status: 404 },
            );
        }

        const isUpload = upload instanceof File && upload.size > 0;
        let image;
        let figure = null;
        if (isUpload) {
            if (
                rightsAttestation !== FIGURE_RIGHTS_ATTESTATION_VERSION
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Confirm that you are permitted to process this image.",
                        code: "RIGHTS_CONFIRMATION_REQUIRED",
                    },
                    { status: 403 },
                );
            }
            if (!isFigureCaptureMethod(captureMethod)) {
                return NextResponse.json(
                    {
                        error: "Choose a valid figure capture method.",
                        code: "INVALID_CAPTURE_METHOD",
                    },
                    { status: 400 },
                );
            }
            if (upload.size > MAX_FIGURE_BYTES) {
                return NextResponse.json(
                    { error: "Figure images must be no larger than 5 MB." },
                    { status: 413 },
                );
            }
            image = validateFigureBytes(
                await upload.arrayBuffer(),
                upload.type || undefined,
            );
        } else {
            if (
                !paper.access.canSendToAI ||
                !paper.access.canPersistContent
            ) {
                return NextResponse.json(
                    { error: paper.access.policyReason },
                    { status: 403 },
                );
            }
            figure = findPaperFigure(paper, figureId);
            if (!figure) {
                return NextResponse.json(
                    { error: "Figure not found in this paper." },
                    { status: 404 },
                );
            }
            if (!figure.canAnalyzeSourceImage || !figure.imageUrl) {
                return NextResponse.json(
                    {
                        error:
                            "This source figure is not cleared for automatic analysis. Upload a screenshot instead.",
                        code: "UPLOAD_REQUIRED",
                    },
                    { status: 403 },
                );
            }
            image = await fetchFigureImage(figure.imageUrl);
        }

        const quota = await consumeQuota({
            plan,
            feature: "chat",
            identity: userID,
            userID,
            unlimited: isAdmin,
        });
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error: "Monthly AI question limit reached.",
                    code: "QUOTA_EXCEEDED",
                    quota,
                },
                { status: 429 },
            );
        }
        quotaConsumed = !isAdmin;

        let savedPaper = await findSavedPaperForUser({
            userID: request.user._id,
            primarySource: sourceConfig.label,
            paperId: normalizedPaperId,
            idName,
        });
        const storedHistory = savedPaper
            ? await Message.find({ savedPaperID: savedPaper._id })
                  .sort({ createdAt: -1 })
                  .limit(6)
                  .lean()
            : [];
        const answer = await respondToFigure({
            question,
            imageDataUrl: figureImageDataUrl(image),
            figureContext: buildFigureContext(
                paper,
                figure,
                isUpload ? userCaption : undefined,
            ),
            chatHistory: storedHistory
                .reverse()
                .map((message: any) => ({
                    sender: String(message.sender),
                    message: String(message.message).slice(0, 1_500),
                })),
            usageContext: {
                feature: "chat",
                userID,
                metadata: {
                    operation: "figure_analysis",
                    source: database,
                    input: isUpload ? "upload" : "source",
                    imageBytes: image.bytes.length,
                    ...(isUpload
                        ? {
                              captureMethod,
                              rightsAttestationVersion:
                                  FIGURE_RIGHTS_ATTESTATION_VERSION,
                          }
                        : {}),
                    ...(figure ? { figureId: figure.id } : {}),
                },
            },
        });
        if (!answer) throw new Error("The AI did not return a response.");

        if (!savedPaper) {
            savedPaper = await SavedPaper.findOneAndUpdate(
                {
                    userID: request.user._id,
                    primarySource: sourceConfig.label,
                    paperId: normalizedPaperId,
                    idName,
                },
                {
                    $setOnInsert: {
                        userID: request.user._id,
                        primarySource: sourceConfig.label,
                        paperId: normalizedPaperId,
                        idName,
                    },
                },
                { new: true, upsert: true },
            );
        }
        const promptLabel = figure?.label || "uploaded figure";
        const persistedQuestion = `Explain ${promptLabel}: ${question}`;
        const [, savedAnswer] = await Message.create([
            {
                savedPaperID: savedPaper._id,
                sender: "user",
                message: persistedQuestion,
            },
            {
                savedPaperID: savedPaper._id,
                sender: "ai",
                message: answer,
            },
        ]);

        return NextResponse.json(
            {
                userMessage: persistedQuestion,
                aiResponse: {
                    id: savedAnswer._id,
                    sender: "ai",
                    message: savedAnswer.message,
                    timestamp: savedAnswer.createdAt,
                },
                quota,
            },
            {
                headers: { "Cache-Control": "private, no-store" },
            },
        );
    } catch (error) {
        if (quotaConsumed) {
            await refundQuota({
                plan,
                feature: "chat",
                identity: userID,
            }).catch(() => undefined);
        }
        console.error("Figure analysis failed");
        const message =
            error instanceof Error &&
            /image|figure|supported|dimensions|5 MB/i.test(error.message)
                ? error.message
                : "The figure analysis service is unavailable.";
        const status =
            /supported|dimensions|5 MB|image type/i.test(message) ? 422 : 500;
        return NextResponse.json({ error: message }, { status });
    }
});
