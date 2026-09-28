import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin } from "../../../lib/admin";
import { recordAdminAction } from "../../../lib/admin-audit";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import ForumPost from "../../../models/ForumPost";
import ForumComment from "../../../models/ForumComment";
import ForumReport from "../../../models/ForumReport";
import User from "../../../models/User";

type Id = { toString(): string };
const actions = new Set(["hide", "restore", "remove", "dismiss"]);

// Moderation queue: every reported item with open reports, most reported first.
export const GET = withAdmin(async () => {
    const open = (await ForumReport.aggregate([
        { $match: { resolved: false } },
        {
            $group: {
                _id: { type: "$targetType", id: "$targetID" },
                reasons: { $push: "$reason" },
                details: { $push: "$details" },
                count: { $sum: 1 },
                lastAt: { $max: "$createdAt" },
            },
        },
        { $sort: { count: -1, lastAt: -1 } },
        { $limit: 100 },
    ])) as Array<{
        _id: { type: "post" | "comment"; id: Id };
        reasons: string[];
        details: string[];
        count: number;
        lastAt: Date;
    }>;
    const postIds = open.filter((row) => row._id.type === "post").map((row) => row._id.id);
    const commentIds = open.filter((row) => row._id.type === "comment").map((row) => row._id.id);
    const [posts, comments] = await Promise.all([
        ForumPost.find({ _id: { $in: postIds } }).select("authorID paperTitle body status").lean(),
        ForumComment.find({ _id: { $in: commentIds } }).select("authorID postID body status").lean(),
    ]);
    const targets = new Map<string, { authorID: Id; text: string; status: string; postId: string; title?: string }>();
    for (const post of posts as unknown as Array<{ _id: Id; authorID: Id; paperTitle: string; body: string; status: string }>) {
        targets.set(post._id.toString(), { authorID: post.authorID, text: post.body, status: post.status, postId: post._id.toString(), title: post.paperTitle });
    }
    for (const comment of comments as unknown as Array<{ _id: Id; authorID: Id; postID: Id; body: string; status: string }>) {
        targets.set(comment._id.toString(), { authorID: comment.authorID, text: comment.body, status: comment.status, postId: comment.postID.toString() });
    }
    const authors = (await User.find({
        _id: { $in: [...targets.values()].map((target) => target.authorID) },
    })
        .select("firstName lastName email")
        .lean()) as unknown as Array<{ _id: Id; firstName: string; lastName: string; email: string }>;
    const authorById = new Map(authors.map((author) => [author._id.toString(), author]));

    return NextResponse.json({
        reports: open
            .map((row) => {
                const target = targets.get(row._id.id.toString());
                if (!target) return null;
                const author = authorById.get(target.authorID.toString());
                return {
                    targetType: row._id.type,
                    targetId: row._id.id.toString(),
                    postId: target.postId,
                    title: target.title || null,
                    text: target.text,
                    status: target.status,
                    author: author
                        ? { name: `${author.firstName} ${author.lastName}`.trim(), email: author.email }
                        : null,
                    count: row.count,
                    reasons: row.reasons,
                    details: row.details.filter(Boolean),
                    lastAt: row.lastAt,
                };
            })
            .filter(Boolean),
    });
});

export const POST = withAdmin(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const targetType = body?.targetType === "comment" ? "comment" : body?.targetType === "post" ? "post" : null;
    const targetId = String(body?.targetId || "");
    const action = String(body?.action || "");
    if (!targetType || !mongoose.isValidObjectId(targetId) || !actions.has(action)) {
        return NextResponse.json({ error: "A valid moderation action is required." }, { status: 400 });
    }
    const Model = targetType === "post" ? ForumPost : ForumComment;
    const status =
        action === "hide" ? "hidden" : action === "remove" ? "removed" : action === "restore" ? "visible" : null;
    if (status) {
        const update: Record<string, unknown> = { status };
        // Restoring clears the count so it doesn't re-hide on the next report.
        if (action === "restore") update.reportCount = 0;
        await Model.updateOne({ _id: targetId }, { $set: update });
    }
    await ForumReport.updateMany({ targetType, targetID: targetId, resolved: false }, { $set: { resolved: true } });
    await recordAdminAction({
        adminEmail: request.user.email,
        action: `forum.${action}`,
        target: `${targetType}:${targetId}`,
        before: null,
        after: { status },
    });
    return NextResponse.json({ ok: true, status });
});
