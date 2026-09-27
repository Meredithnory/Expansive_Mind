import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../../authMiddleware";
import GroupMember from "../../../../models/GroupMember";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { loadMembership } from "../../access";

type RouteContext = { params: Promise<{ id: string }> };

// Leave a group (userId = yourself) or, as owner, remove a member. Their
// posts and comments stay so threads keep making sense; they can delete
// their own before leaving.
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
        const userId = String(body?.userId || "");
        if (!mongoose.isValidObjectId(userId)) {
            return NextResponse.json({ error: "A member is required." }, { status: 400 });
        }
        const me = req.user._id.toString();
        if (userId === me && membership.role === "owner") {
            return NextResponse.json(
                { error: "You own this group. Delete the group instead of leaving it." },
                { status: 409 },
            );
        }
        if (userId !== me && membership.role !== "owner") {
            return NextResponse.json({ error: "Only the owner can remove members." }, { status: 403 });
        }
        await GroupMember.deleteOne({ groupID: id, userID: userId, role: "member" });
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    })(request);
}
