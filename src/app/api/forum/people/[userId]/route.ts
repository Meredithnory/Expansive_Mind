import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withOptionalAuth } from "../../../authMiddleware";
import Follow from "../../../../models/Follow";
import Block from "../../../../models/Block";
import ForumPost from "../../../../models/ForumPost";
import User from "../../../../models/User";
import { loadPeople, viewerFrom } from "../../view";

type RouteContext = { params: Promise<{ userId: string }> };

// A person's public forum profile. Posts load from /api/forum?author=.
export async function GET(request: NextRequest, context: RouteContext) {
    return withOptionalAuth(async (req) => {
        const { userId } = await context.params;
        if (!mongoose.isValidObjectId(userId)) {
            return NextResponse.json({ error: "Person not found." }, { status: 404 });
        }
        const person = await loadPeople([userId]);
        const profile = person(userId);
        if (profile.name === "Former member") {
            return NextResponse.json({ error: "Person not found." }, { status: 404 });
        }
        const viewer = viewerFrom(req.user);
        const [followers, following, posts, isFollowing, isBlocked, bioDoc] = await Promise.all([
            Follow.countDocuments({ followeeID: userId }),
            Follow.countDocuments({ followerID: userId }),
            ForumPost.countDocuments({ authorID: userId, status: "visible" }),
            viewer.id ? Follow.exists({ followerID: viewer.id, followeeID: userId }) : null,
            viewer.id ? Block.exists({ blockerID: viewer.id, blockedID: userId }) : null,
            User.findById(userId).select("bio submittedAt").lean() as Promise<{
                bio?: string;
                submittedAt?: Date;
            } | null>,
        ]);
        return NextResponse.json(
            {
                person: {
                    ...profile,
                    bio: typeof bioDoc?.bio === "string" ? bioDoc.bio : "",
                    // Sign-up date; accounts without it fall back to when the
                    // record was created (the id's timestamp).
                    joinedAt: (
                        bioDoc?.submittedAt ??
                        new mongoose.Types.ObjectId(userId).getTimestamp()
                    ).toISOString(),
                    followers,
                    following,
                    posts,
                    isMe: viewer.id === userId,
                    isFollowing: Boolean(isFollowing),
                    isBlocked: Boolean(isBlocked),
                },
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    })(request);
}
