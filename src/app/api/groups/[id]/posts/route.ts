import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../../authMiddleware";
import GroupPost from "../../../../models/GroupPost";
import GroupComment from "../../../../models/GroupComment";
import PaperHighlight from "../../../../models/PaperHighlight";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { consumeRateLimit } from "../../../../lib/rate-limit";
import { parseHighlightLookup } from "../../../../lib/paper-highlights";
import {
    evaluateQuoteEligibility,
    paperHasFullTextBody,
    quoteLicenseFromHome,
} from "../../../../lib/quote-eligibility";
import {
    GROUP_NOTE_MAX,
    GROUP_POST_HIGHLIGHT_LIMIT,
    parseGroupText,
} from "../../../../lib/groups";
import { loadCachedPaperBySource } from "../../../paper/load-paper";
import { loadMembership } from "../../access";

type RouteContext = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "private, no-store" };

type HighlightDoc = {
    _id: mongoose.Types.ObjectId;
    excerpt: string;
    color: string;
    citation: { sectionTitle: string; startLine: number; endLine: number };
};

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

        // Only your own highlights, and only ones on this paper.
        const highlights = (await PaperHighlight.find({
            _id: { $in: highlightIds },
            userID: req.user._id,
            primarySource: lookup.primarySource,
            paperId: lookup.paperId,
            idName: lookup.idName,
        })
            .sort({ createdAt: 1 })
            .lean()) as unknown as HighlightDoc[];
        if (highlights.length === 0 && !note) {
            return NextResponse.json({ error: "Add a note or pick at least one highlight." }, { status: 400 });
        }

        const loaded = await loadCachedPaperBySource(
            lookup.database,
            lookup.paperId,
            lookup.idName,
        ).catch(() => null);
        const paper = loaded?.value;
        if (!paper) {
            return NextResponse.json({ error: "That paper couldn't be loaded. Try again." }, { status: 502 });
        }
        // Same strict gate as claim-ledger quotes: only open-license home
        // full text may be shown to other people.
        const licenses = quoteLicenseFromHome(paper.access);
        const quotable = evaluateQuoteEligibility({
            source: paper.source || lookup.database,
            database: lookup.database,
            contentLabel: paper.contentLabel,
            hasFullTextBody: paperHasFullTextBody(paper),
            rawLicense: licenses.rawLicense,
            licenseUrl: licenses.licenseUrl,
        }).allowed;

        const post = await GroupPost.create({
            groupID: id,
            authorID: req.user._id,
            database: lookup.database,
            paperId: lookup.paperId,
            idName: lookup.idName,
            paperTitle: String(paper.title || "Untitled paper").slice(0, 500),
            note,
            quotable,
            highlights: highlights.map((highlight) => ({
                excerpt: quotable ? highlight.excerpt : null,
                sectionTitle: highlight.citation.sectionTitle,
                startLine: highlight.citation.startLine,
                endLine: highlight.citation.endLine,
                color: highlight.color || "pink",
            })),
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
