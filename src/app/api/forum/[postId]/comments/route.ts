import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../../authMiddleware";
import ForumPost from "../../../../models/ForumPost";
import ForumComment from "../../../../models/ForumComment";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { consumeRateLimit } from "../../../../lib/rate-limit";
import { parseGroupText } from "../../../../lib/groups";
import { FORUM_COMMENT_MAX, canPostPublicly } from "../../../../lib/forum";
import { viewerFrom } from "../../view";

type RouteContext = { params: Promise<{ postId: string }> };
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        if (!canPostPublicly(req.user.submittedAt)) {
            return NextResponse.json(
                { error: "New accounts can comment publicly after their first day." },
                { status: 403 },
            );
        }
        const rateLimit = await consumeRateLimit({
            scope: "forum-comment",
            identity: req.user._id.toString(),
            limit: 30,
            windowMs: 10 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: "Slow down a little and try again." }, { status: 429 });
        }
        const { postId } = await context.params;
        const body = await req.json().catch(() => null);
        const text = parseGroupText(body?.body, FORUM_COMMENT_MAX);
        const highlightId = body?.highlightId ? String(body.highlightId) : null;
        if (!mongoose.isValidObjectId(postId) || !text) {
            return NextResponse.json({ error: "Write a comment under 2,000 characters." }, { status: 400 });
        }
        const post = (await ForumPost.findOne({ _id: postId, status: "visible" })
            .select("highlights._id")
            .lean()) as unknown as { highlights: Array<{ _id: { toString(): string } }> } | null;
        if (!post) {
            return NextResponse.json({ error: "This post isn't available." }, { status: 404 });
        }
        if (highlightId && !post.highlights.some((h) => h._id.toString() === highlightId)) {
            return NextResponse.json({ error: "That highlight isn't in this post." }, { status: 400 });
        }
        const comment = await ForumComment.create({
            postID: postId,
            highlightID: highlightId,
            authorID: req.user._id,
            body: text,
        });
        await ForumPost.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
        return NextResponse.json({ commentId: comment._id.toString() }, { status: 201, headers: noStore });
    })(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        const { postId } = await context.params;
        const body = await req.json().catch(() => null);
        const commentId = String(body?.commentId || "");
        if (!mongoose.isValidObjectId(commentId) || !mongoose.isValidObjectId(postId)) {
            return NextResponse.json({ error: "A comment is required." }, { status: 400 });
        }
        const viewer = viewerFrom(req.user);
        const filter = viewer.isAdmin
            ? { _id: commentId, postID: postId, status: { $ne: "removed" } }
            : { _id: commentId, postID: postId, authorID: req.user._id, status: { $ne: "removed" } };
        const result = await ForumComment.updateOne(filter, { $set: { status: "removed" } });
        if (result.modifiedCount) {
            await ForumPost.updateOne({ _id: postId }, { $inc: { commentCount: -1 } });
        }
        return NextResponse.json({ ok: Boolean(result.modifiedCount) }, { headers: noStore });
    })(request);
}
