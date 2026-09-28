import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../authMiddleware";
import Block from "../../../models/Block";
import Follow from "../../../models/Follow";
import User from "../../../models/User";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { consumeRateLimit } from "../../../lib/rate-limit";

async function target(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const userId = String(body?.userId || "");
    if (!mongoose.isValidObjectId(userId) || userId === request.user._id.toString()) {
        return null;
    }
    return (await User.exists({ _id: userId })) ? userId : null;
}

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const rateLimit = await consumeRateLimit({
        scope: "forum-block",
        identity: request.user._id.toString(),
        limit: 100,
        windowMs: 60 * 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Try again later." }, { status: 429 });
    }
    const userId = await target(request);
    if (!userId) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    await Block.updateOne(
        { blockerID: request.user._id, blockedID: userId },
        { $setOnInsert: { blockerID: request.user._id, blockedID: userId } },
        { upsert: true },
    );
    // Blocking ends any follow between the two people.
    await Follow.deleteMany({
        $or: [
            { followerID: request.user._id, followeeID: userId },
            { followerID: userId, followeeID: request.user._id },
        ],
    });
    return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const userId = await target(request);
    if (!userId) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    await Block.deleteOne({ blockerID: request.user._id, blockedID: userId });
    return NextResponse.json({ ok: true });
});
