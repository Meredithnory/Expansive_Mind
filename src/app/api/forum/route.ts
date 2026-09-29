import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth, withOptionalAuth } from "../authMiddleware";
import ForumPost from "../../models/ForumPost";
import Follow from "../../models/Follow";
import { hasValidMutationOrigin } from "../../lib/request-security";
import { consumeRateLimit } from "../../lib/rate-limit";
import { parseHighlightLookup } from "../../lib/paper-highlights";
import { parseGroupText } from "../../lib/groups";
import { snapshotSharedHighlights } from "../../lib/shared-highlights";
import {
    FORUM_BODY_MAX,
    FORUM_HIGHLIGHT_LIMIT,
    FORUM_PAGE_SIZE,
    canPostPublicly,
    isTag,
    parseTags,
} from "../../lib/forum";
import {
    blockedBy,
    loadPeople,
    serializePost,
    viewerFrom,
    type PostDoc,
} from "./view";

const noStore = { "Cache-Control": "private, no-store" };

// Public feed: ?feed=latest|following, ?tag=, ?author=, ?before=<ISO date>.
export const GET = withOptionalAuth(async (request: NextRequest) => {
    const viewer = viewerFrom(request.user);
    const params = request.nextUrl.searchParams;
    const feed = params.get("feed") === "following" ? "following" : "latest";
    const tag = params.get("tag");
    const author = params.get("author");
    const before = params.get("before");

    const filter: Record<string, unknown> = { status: "visible" };
    if (tag && isTag(tag)) filter.tags = tag;
    if (author && mongoose.isValidObjectId(author)) {
        filter.authorID = new mongoose.Types.ObjectId(author);
        // Authors see their own hidden posts on their page, with a status.
        if (viewer.id === author) filter.status = { $in: ["visible", "hidden"] };
    }
    if (before && !Number.isNaN(Date.parse(before))) {
        filter.createdAt = { $lt: new Date(before) };
    }

    const blocked = await blockedBy(viewer);
    if (feed === "following") {
        if (!viewer.id) {
            return NextResponse.json({ error: "Sign in to see who you follow." }, { status: 401 });
        }
        const follows = (await Follow.find({ followerID: viewer.id })
            .select("followeeID")
            .lean()) as unknown as Array<{ followeeID: mongoose.Types.ObjectId }>;
        filter.authorID = {
            $in: follows
                .map((row) => row.followeeID)
                .filter((id) => !blocked.includes(id.toString())),
        };
    } else if (blocked.length && !filter.authorID) {
        filter.authorID = { $nin: blocked.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const posts = (await ForumPost.find(filter)
        .sort({ createdAt: -1 })
        .limit(FORUM_PAGE_SIZE + 1)
        .lean()) as unknown as PostDoc[];
    const page = posts.slice(0, FORUM_PAGE_SIZE);
    const person = await loadPeople(page.map((post) => post.authorID.toString()));
    return NextResponse.json(
        {
            posts: page.map((post) => serializePost(post, person, viewer)),
            nextBefore:
                posts.length > FORUM_PAGE_SIZE
                    ? page[page.length - 1].createdAt
                    : null,
        },
        { headers: noStore },
    );
});

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    if (!canPostPublicly(request.user.submittedAt)) {
        return NextResponse.json(
            {
                error: "New accounts can post publicly after their first day. You can read, follow, and share to groups now.",
            },
            { status: 403 },
        );
    }
    const rateLimit = await consumeRateLimit({
        scope: "forum-post",
        identity: request.user._id.toString(),
        limit: 10,
        windowMs: 24 * 60 * 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "You've reached today's limit of 10 public posts." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const lookup = parseHighlightLookup({
        database: body?.database,
        paperId: body?.paperId,
        idName: body?.idName,
    });
    const text = parseGroupText(body?.body ?? "", FORUM_BODY_MAX);
    const highlightIds: string[] = Array.isArray(body?.highlightIds)
        ? body.highlightIds.map(String)
        : [];
    if (!lookup || text === null) {
        return NextResponse.json({ error: "A paper and a post under 2,000 characters are required." }, { status: 400 });
    }
    if (highlightIds.length > FORUM_HIGHLIGHT_LIMIT) {
        return NextResponse.json({ error: `Post up to ${FORUM_HIGHLIGHT_LIMIT} highlights at a time.` }, { status: 400 });
    }

    const snapshot = await snapshotSharedHighlights(request.user._id, lookup, highlightIds);
    if (!snapshot) {
        return NextResponse.json({ error: "That paper couldn't be loaded. Try again." }, { status: 502 });
    }
    if (!text && snapshot.highlights.length === 0) {
        return NextResponse.json({ error: "Say something about the paper or pick a highlight." }, { status: 400 });
    }

    const post = await ForumPost.create({
        authorID: request.user._id,
        database: lookup.database,
        paperId: lookup.paperId,
        idName: lookup.idName,
        paperTitle: snapshot.paperTitle,
        body: text,
        tags: parseTags(body?.tags),
        quotable: snapshot.quotable,
        highlights: snapshot.highlights,
    });
    return NextResponse.json(
        { postId: post._id.toString(), quotable: snapshot.quotable },
        { status: 201, headers: noStore },
    );
});
