import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../../authMiddleware";
import GroupPost from "../../../../models/GroupPost";
import GroupComment from "../../../../models/GroupComment";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { consumeRateLimit } from "../../../../lib/rate-limit";
import { parseHighlightLookup } from "../../../../lib/paper-highlights";
import {
    GROUP_NOTE_MAX,
    GROUP_POST_HIGHLIGHT_LIMIT,
    parseGroupText,
} from "../../../../lib/groups";
import { snapshotSharedHighlights } from "../../../../lib/shared-highlights";
import { loadMembership } from "../../access";

type RouteContext = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "private, no-store" };

// Share a paper (and some of your highlights on it) into a group.
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
            scope: "groups-post",
            identity: req.user._id.toString(),
            limit: 30,
            windowMs: 60 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: "You're sharing a lot. Try again soon." }, { status: 429 });
        }

        const body = await req.json().catch(() => null);
        const lookup = parseHighlightLookup({
            database: body?.database,
            paperId: body?.paperId,
            idName: body?.idName,
        });
        const note = parseGroupText(body?.note ?? "", GROUP_NOTE_MAX);
        const highlightIds: string[] = Array.isArray(body?.highlightIds)
            ? body.highlightIds.filter((value: unknown) =>
                  mongoose.isValidObjectId(value),
              )
            : [];
        if (!lookup || note === null) {
            return NextResponse.json({ error: "A paper and a note under 1,000 characters are required." }, { status: 400 });
        }
        if (highlightIds.length > GROUP_POST_HIGHLIGHT_LIMIT) {
            return NextResponse.json({ error: `Share up to ${GROUP_POST_HIGHLIGHT_LIMIT} highlights at a time.` }, { status: 400 });
        }

        const snapshot = await snapshotSharedHighlights(
            req.user._id,
            lookup,
            highlightIds,
        );
        if (!snapshot) {
            return NextResponse.json({ error: "That paper couldn't be loaded. Try again." }, { status: 502 });
        }
        if (snapshot.highlights.length === 0 && !note) {
            return NextResponse.json({ error: "Add a note or pick at least one highlight." }, { status: 400 });
        }
        const { quotable } = snapshot;

        const post = await GroupPost.create({
            groupID: id,
            authorID: req.user._id,
            database: lookup.database,
            paperId: lookup.paperId,
            idName: lookup.idName,
            paperTitle: snapshot.paperTitle,
            note,
            quotable,
            highlights: snapshot.highlights,
        });
        return NextResponse.json(
            { postId: post._id.toString(), quotable },
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
        const postId = String(body?.postId || "");
        if (!mongoose.isValidObjectId(postId)) {
            return NextResponse.json({ error: "A post is required." }, { status: 400 });
        }
        const filter =
            membership.role === "owner"
                ? { _id: postId, groupID: id }
                : { _id: postId, groupID: id, authorID: req.user._id };
        const removed = await GroupPost.deleteOne(filter);
        if (removed.deletedCount) await GroupComment.deleteMany({ postID: postId });
        return NextResponse.json({ ok: Boolean(removed.deletedCount) }, { headers: noStore });
    })(request);
}
