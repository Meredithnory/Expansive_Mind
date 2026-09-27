import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../../authMiddleware";
import GroupPost from "../../../../models/GroupPost";
import GroupComment from "../../../../models/GroupComment";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { consumeRateLimit } from "../../../../lib/rate-limit";
import { GROUP_COMMENT_MAX, parseGroupText } from "../../../../lib/groups";
import { loadMembership } from "../../access";

type RouteContext = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        const { id } = await context.params;
        const membership = await loadMembership(id, req.user._id);
        if (!membership) {
            return NextResponse.json({ error: "Group not found." }, { status: 404 });
        }
        const rateLimit = await consumeRateLimit({
            scope: "groups-comment",
            identity: req.user._id.toString(),
            limit: 60,
            windowMs: 10 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: "Slow down a little and try again." }, { status: 429 });
        }
        const body = await req.json().catch(() => null);
        const postId = String(body?.postId || "");
        const highlightId = body?.highlightId ? String(body.highlightId) : null;
        const text = parseGroupText(body?.body, GROUP_COMMENT_MAX);
        if (!mongoose.isValidObjectId(postId) || !text) {
            return NextResponse.json({ error: "Write a comment under 2,000 characters." }, { status: 400 });
        }
        const post = (await GroupPost.findOne({ _id: postId, groupID: id })
            .select("highlights._id")
            .lean()) as unknown as { highlights: Array<{ _id: { toString(): string } }> } | null;
        if (!post) {
            return NextResponse.json({ error: "That post is gone." }, { status: 404 });
        }
        if (
            highlightId &&
            !post.highlights.some((highlight) => highlight._id.toString() === highlightId)
        ) {
            return NextResponse.json({ error: "That highlight isn't in this post." }, { status: 400 });
        }
        const comment = await GroupComment.create({
            groupID: id,
            postID: postId,
            highlightID: highlightId,
            authorID: req.user._id,
            body: text,
        });
        return NextResponse.json(
            { commentId: comment._id.toString() },
            { status: 201, headers: noStore },
        );
    })(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        const { id } = await context.params;
        const membership = await loadMembership(id, req.user._id);
        if (!membership) {
            return NextResponse.json({ error: "Group not found." }, { status: 404 });
        }
        const body = await req.json().catch(() => null);
        const commentId = String(body?.commentId || "");
        if (!mongoose.isValidObjectId(commentId)) {
            return NextResponse.json({ error: "A comment is required." }, { status: 400 });
        }
        const filter =
            membership.role === "owner"
                ? { _id: commentId, groupID: id }
                : { _id: commentId, groupID: id, authorID: req.user._id };
        const removed = await GroupComment.deleteOne(filter);
        return NextResponse.json({ ok: Boolean(removed.deletedCount) }, { headers: noStore });
    })(request);
}
