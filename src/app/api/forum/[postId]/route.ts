import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth, withOptionalAuth } from "../../authMiddleware";
import ForumPost from "../../../models/ForumPost";
import ForumComment from "../../../models/ForumComment";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import {
    blockedBy,
    loadPeople,
    serializePost,
    viewerFrom,
    type PostDoc,
} from "../view";

type RouteContext = { params: Promise<{ postId: string }> };
const noStore = { "Cache-Control": "private, no-store" };
const notFound = () =>
    NextResponse.json({ error: "This post isn't available." }, { status: 404, headers: noStore });

type CommentDoc = {
    _id: { toString(): string };
    highlightID: { toString(): string } | null;
    authorID: { toString(): string };
    body: string;
    status: string;
    createdAt: Date;
};

export async function GET(request: NextRequest, context: RouteContext) {
    return withOptionalAuth(async (req) => {
        const { postId } = await context.params;
        if (!mongoose.isValidObjectId(postId)) return notFound();
        const viewer = viewerFrom(req.user);
        const post = (await ForumPost.findById(postId).lean()) as unknown as PostDoc | null;
        if (!post || post.status === "removed") return notFound();
        const mine = viewer.id === post.authorID.toString();
        if (post.status === "hidden" && !mine && !viewer.isAdmin) return notFound();

        const blocked = await blockedBy(viewer);
        const comments = ((await ForumComment.find({
            postID: postId,
            status: viewer.isAdmin ? { $ne: "removed" } : "visible",
        })
            .sort({ createdAt: 1 })
            .limit(500)
            .lean()) as unknown as CommentDoc[]).filter(
            (comment) => !blocked.includes(comment.authorID.toString()),
        );
        const person = await loadPeople([
            post.authorID.toString(),
            ...comments.map((comment) => comment.authorID.toString()),
        ]);
        return NextResponse.json(
            {
                post: serializePost(post, person, viewer),
                comments: comments.map((comment) => ({
                    id: comment._id.toString(),
                    highlightId: comment.highlightID?.toString() || null,
                    author: person(comment.authorID),
                    body: comment.body,
                    createdAt: comment.createdAt,
                    status: viewer.isAdmin ? comment.status : undefined,
                    canDelete:
                        viewer.isAdmin || viewer.id === comment.authorID.toString(),
                })),
            },
            { headers: noStore },
        );
    })(request);
}

// Authors and admins remove a post. Kept as "removed" (not deleted) so
// reports about it still make sense in the admin queue.
export async function DELETE(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        const { postId } = await context.params;
        if (!mongoose.isValidObjectId(postId)) return notFound();
        const viewer = viewerFrom(req.user);
        const filter = viewer.isAdmin
            ? { _id: postId }
            : { _id: postId, authorID: req.user._id };
        const result = await ForumPost.updateOne(filter, { $set: { status: "removed" } });
        if (!result.matchedCount) return notFound();
        return NextResponse.json({ ok: true }, { headers: noStore });
    })(request);
}
