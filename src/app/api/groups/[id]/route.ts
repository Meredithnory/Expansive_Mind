import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../authMiddleware";
import Group from "../../../models/Group";
import GroupMember from "../../../models/GroupMember";
import GroupPost from "../../../models/GroupPost";
import GroupComment from "../../../models/GroupComment";
import User from "../../../models/User";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { buildPaperPath, type SourceDatabase } from "../../../lib/paper-sources";
import { GROUP_FEED_LIMIT, parseGroupName } from "../../../lib/groups";
import { paperLinesHref } from "../../../lib/paper-lines";
import { authorView, loadMembership } from "../access";

type RouteContext = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "private, no-store" };
const notFound = () =>
    NextResponse.json({ error: "Group not found." }, { status: 404, headers: noStore });

type Id = { toString(): string };
type PostDoc = {
    _id: Id;
    authorID: Id;
    database: SourceDatabase;
    paperId: string;
    idName: string;
    paperTitle: string;
    note: string;
    quotable: boolean;
    highlights: Array<{
        _id: Id;
        excerpt: string | null;
        sectionTitle: string;
        startLine: number;
        endLine: number;
        color: string;
    }>;
    createdAt: Date;
};
type CommentDoc = {
    _id: Id;
    postID: Id;
    highlightID: Id | null;
    authorID: Id;
    body: string;
    createdAt: Date;
};

export async function GET(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        const { id } = await context.params;
        const membership = await loadMembership(id, req.user._id);
        if (!membership) return notFound();
        const me = req.user._id.toString();
        const isOwner = membership.role === "owner";

        const [members, posts] = await Promise.all([
            GroupMember.find({ groupID: id }).sort({ createdAt: 1 }).lean(),
            GroupPost.find({ groupID: id })
                .sort({ createdAt: -1 })
                .limit(GROUP_FEED_LIMIT)
                .lean(),
        ]);
        const postDocs = posts as unknown as PostDoc[];
        const comments = (await GroupComment.find({
            postID: { $in: postDocs.map((post) => post._id) },
        })
            .sort({ createdAt: 1 })
            .lean()) as unknown as CommentDoc[];

        const userIds = new Set<string>();
        for (const member of members as unknown as Array<{ userID: Id }>) {
            userIds.add(member.userID.toString());
        }
        for (const post of postDocs) userIds.add(post.authorID.toString());
        for (const comment of comments) userIds.add(comment.authorID.toString());
        const users = await User.find({ _id: { $in: [...userIds] } })
            .select("firstName lastName profileColor badge")
            .lean();
        const userById = new Map(
            (users as unknown as Array<{ _id: Id }>).map((user) => [
                user._id.toString(),
                user,
            ]),
        );
        const author = (userId: Id) =>
            authorView(userById.get(userId.toString()) as Parameters<typeof authorView>[0]);

        return NextResponse.json(
            {
                group: {
                    id,
                    name: membership.group.name,
                    role: membership.role,
                    inviteCode: isOwner ? membership.group.inviteCode : null,
                },
                members: (members as unknown as Array<{ userID: Id; role: string }>).map(
                    (member) => ({
                        ...author(member.userID),
                        role: member.role,
                        isMe: member.userID.toString() === me,
                    }),
                ),
                posts: postDocs.map((post) => {
                    const path = buildPaperPath(post.database, post.paperId, post.idName);
                    const mine = post.authorID.toString() === me;
                    return {
                        id: post._id.toString(),
                        author: author(post.authorID),
                        paper: { title: post.paperTitle, href: path },
                        note: post.note,
                        quotable: post.quotable,
                        createdAt: post.createdAt,
                        canDelete: mine || isOwner,
                        highlights: post.highlights.map((highlight) => ({
                            id: highlight._id.toString(),
                            excerpt: post.quotable ? highlight.excerpt : null,
                            sectionTitle: highlight.sectionTitle,
                            color: highlight.color,
                            href: paperLinesHref(path, highlight.startLine, highlight.endLine),
                        })),
                        comments: comments
                            .filter((comment) => comment.postID.toString() === post._id.toString())
                            .map((comment) => ({
                                id: comment._id.toString(),
                                highlightId: comment.highlightID?.toString() || null,
                                author: author(comment.authorID),
                                body: comment.body,
                                createdAt: comment.createdAt,
                                canDelete: comment.authorID.toString() === me || isOwner,
                            })),
                    };
                }),
            },
            { headers: noStore },
        );
    })(request);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        const { id } = await context.params;
        const membership = await loadMembership(id, req.user._id);
        if (!membership) return notFound();
        if (membership.role !== "owner") {
            return NextResponse.json({ error: "Only the owner can rename the group." }, { status: 403 });
        }
        const body = await req.json().catch(() => null);
        const name = parseGroupName(body?.name);
        if (!name) {
            return NextResponse.json({ error: "Give the group a name (up to 60 characters)." }, { status: 400 });
        }
        await Group.updateOne({ _id: id }, { $set: { name } });
        return NextResponse.json({ name }, { headers: noStore });
    })(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        if (!hasValidMutationOrigin(req)) {
            return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
        }
        const { id } = await context.params;
        const membership = await loadMembership(id, req.user._id);
        if (!membership) return notFound();
        if (membership.role !== "owner") {
            return NextResponse.json({ error: "Only the owner can delete the group." }, { status: 403 });
        }
        const groupID = new mongoose.Types.ObjectId(id);
        await Promise.all([
            GroupComment.deleteMany({ groupID }),
            GroupPost.deleteMany({ groupID }),
            GroupMember.deleteMany({ groupID }),
        ]);
        await Group.deleteOne({ _id: groupID });
        return NextResponse.json({ ok: true }, { headers: noStore });
    })(request);
}
