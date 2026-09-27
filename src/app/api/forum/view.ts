import mongoose from "mongoose";
import User from "../../models/User";
import Block from "../../models/Block";
import { isAdminUser } from "../../lib/admin";
import { publicName } from "../../lib/forum";
import { buildPaperPath, type SourceDatabase } from "../../lib/paper-sources";
import { paperLinesHref } from "../../lib/paper-lines";

type Id = { toString(): string };

export type Viewer = { id: string | null; isAdmin: boolean };

export function viewerFrom(user: { _id?: Id; email?: string } | undefined): Viewer {
    return {
        id: user?._id ? user._id.toString() : null,
        isAdmin: Boolean(user && isAdminUser(user)),
    };
}

export type PublicPerson = { id: string; name: string; profileColor: string | null };

/** Only public fields: first name + last initial and profile color. */
export async function loadPeople(ids: Iterable<string>) {
    const unique = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
    const users = unique.length
        ? ((await User.find({ _id: { $in: unique } })
              .select("firstName lastName profileColor")
              .lean()) as unknown as Array<{
              _id: Id;
              firstName?: string;
              lastName?: string;
              profileColor?: string;
          }>)
        : [];
    const people = new Map<string, PublicPerson>();
    for (const user of users) {
        people.set(user._id.toString(), {
            id: user._id.toString(),
            name: publicName(user.firstName, user.lastName),
            profileColor: user.profileColor || null,
        });
    }
    return (id: Id): PublicPerson =>
        people.get(id.toString()) ?? {
            id: id.toString(),
            name: "Former member",
            profileColor: null,
        };
}

export async function blockedBy(viewer: Viewer): Promise<string[]> {
    if (!viewer.id) return [];
    const rows = (await Block.find({ blockerID: viewer.id })
        .select("blockedID")
        .lean()) as unknown as Array<{ blockedID: Id }>;
    return rows.map((row) => row.blockedID.toString());
}

export type PostDoc = {
    _id: Id;
    authorID: Id;
    database: SourceDatabase;
    paperId: string;
    idName: string;
    paperTitle: string;
    body: string;
    tags: string[];
    quotable: boolean;
    status: "visible" | "hidden" | "removed";
    commentCount: number;
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

export function serializePost(
    post: PostDoc,
    person: (id: Id) => PublicPerson,
    viewer: Viewer,
) {
    const path = buildPaperPath(post.database, post.paperId, post.idName);
    const mine = viewer.id === post.authorID.toString();
    return {
        id: post._id.toString(),
        author: person(post.authorID),
        paper: { title: post.paperTitle, href: path },
        body: post.body,
        tags: post.tags,
        quotable: post.quotable,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        // Authors and admins see why a post isn't public.
        status: mine || viewer.isAdmin ? post.status : undefined,
        canDelete: mine || viewer.isAdmin,
        highlights: post.highlights.map((highlight) => ({
            id: highlight._id.toString(),
            excerpt: post.quotable ? highlight.excerpt : null,
            sectionTitle: highlight.sectionTitle,
            color: highlight.color,
            href: paperLinesHref(path, highlight.startLine, highlight.endLine),
        })),
    };
}
