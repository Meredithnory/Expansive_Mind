import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../authMiddleware";
import ForumPost from "../../../models/ForumPost";
import ForumComment from "../../../models/ForumComment";
import ForumReport from "../../../models/ForumReport";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { consumeRateLimit } from "../../../lib/rate-limit";
import { parseGroupText } from "../../../lib/groups";
import { FORUM_AUTO_HIDE_REPORTS, isReportReason } from "../../../lib/forum";

// Report a post or comment. One report per person per item; after
// FORUM_AUTO_HIDE_REPORTS different people report it, it hides until an
// admin reviews it.
export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const rateLimit = await consumeRateLimit({
        scope: "forum-report",
        identity: request.user._id.toString(),
        limit: 20,
        windowMs: 60 * 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
    }
    const body = await request.json().catch(() => null);
    const targetType = body?.targetType === "comment" ? "comment" : body?.targetType === "post" ? "post" : null;
    const targetID = String(body?.targetId || "");
    const details = parseGroupText(body?.details ?? "", 500);
    if (!targetType || !mongoose.isValidObjectId(targetID) || !isReportReason(body?.reason) || details === null) {
        return NextResponse.json({ error: "Pick a reason for the report." }, { status: 400 });
    }
    const Model = targetType === "post" ? ForumPost : ForumComment;
    const target = (await Model.findById(targetID).select("authorID status").lean()) as unknown as {
        authorID: { toString(): string };
        status: string;
    } | null;
    if (!target || target.status === "removed") {
        return NextResponse.json({ error: "That's no longer available." }, { status: 404 });
    }
    if (target.authorID.toString() === request.user._id.toString()) {
        return NextResponse.json({ error: "You can delete your own post instead." }, { status: 400 });
    }
    try {
        await ForumReport.create({
            targetType,
            targetID,
            reporterID: request.user._id,
            reason: body.reason,
            details,
        });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return NextResponse.json({ ok: true, alreadyReported: true });
        }
        throw error;
    }
    const updated = (await Model.findByIdAndUpdate(
        targetID,
        { $inc: { reportCount: 1 } },
        { new: true },
    )
        .select("reportCount status")
        .lean()) as unknown as { reportCount: number; status: string } | null;
    if (updated && updated.status === "visible" && updated.reportCount >= FORUM_AUTO_HIDE_REPORTS) {
        await Model.updateOne({ _id: targetID, status: "visible" }, { $set: { status: "hidden" } });
    }
    return NextResponse.json({ ok: true });
});
