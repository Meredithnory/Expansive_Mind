import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../../authMiddleware";
import Group from "../../../../models/Group";
import { hasValidMutationOrigin } from "../../../../lib/request-security";
import { newInviteCode } from "../../../../lib/groups";
import { loadMembership } from "../../access";

type RouteContext = { params: Promise<{ id: string }> };

// Replace the invite link. Anyone holding the old link can no longer join.
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
        if (membership.role !== "owner") {
            return NextResponse.json({ error: "Only the owner can reset the link." }, { status: 403 });
        }
        const inviteCode = newInviteCode();
        await Group.updateOne({ _id: id }, { $set: { inviteCode } });
        return NextResponse.json(
            { inviteCode },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    })(request);
}
