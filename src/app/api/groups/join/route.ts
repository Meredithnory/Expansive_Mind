import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import Group from "../../../models/Group";
import GroupMember from "../../../models/GroupMember";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import { consumeRateLimit } from "../../../lib/rate-limit";
import {
    GROUP_MEMBER_LIMIT,
    GROUPS_PER_USER_LIMIT,
    isInviteCode,
} from "../../../lib/groups";

const noStore = { "Cache-Control": "private, no-store" };
const notFound = () =>
    NextResponse.json(
        { error: "This invite link isn't valid. Ask for a new one." },
        { status: 404, headers: noStore },
    );

async function limited(userId: string) {
    const result = await consumeRateLimit({
        scope: "groups-join",
        identity: userId,
        limit: 30,
        windowMs: 60 * 60_000,
    });
    return !result.allowed;
}

// Preview: lets someone see which group they're joining before they join.
export const GET = withAuth(async (request: NextRequest) => {
    const code = request.nextUrl.searchParams.get("code");
    if (!isInviteCode(code)) return notFound();
    if (await limited(request.user._id.toString())) {
        return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    }
    const group = (await Group.findOne({ inviteCode: code }).lean()) as unknown as {
        _id: unknown;
        name: string;
    } | null;
    if (!group) return notFound();
    const [memberCount, alreadyMember] = await Promise.all([
        GroupMember.countDocuments({ groupID: group._id }),
        GroupMember.exists({ groupID: group._id, userID: request.user._id }),
    ]);
    return NextResponse.json(
        {
            group: {
                id: String(group._id),
                name: group.name,
                memberCount,
                alreadyMember: Boolean(alreadyMember),
            },
        },
        { headers: noStore },
    );
});

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    if (await limited(request.user._id.toString())) {
        return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    }
    const body = await request.json().catch(() => null);
    if (!isInviteCode(body?.code)) return notFound();
    const group = (await Group.findOne({ inviteCode: body.code }).lean()) as unknown as {
        _id: unknown;
    } | null;
    if (!group) return notFound();
    const groupId = String(group._id);
    if (await GroupMember.exists({ groupID: group._id, userID: request.user._id })) {
        return NextResponse.json({ groupId }, { headers: noStore });
    }
    const [memberCount, myGroups] = await Promise.all([
        GroupMember.countDocuments({ groupID: group._id }),
        GroupMember.countDocuments({ userID: request.user._id }),
    ]);
    if (memberCount >= GROUP_MEMBER_LIMIT) {
        return NextResponse.json(
            { error: `This group is full (${GROUP_MEMBER_LIMIT} members).` },
            { status: 409 },
        );
    }
    if (myGroups >= GROUPS_PER_USER_LIMIT) {
        return NextResponse.json(
            { error: `You can be in up to ${GROUPS_PER_USER_LIMIT} groups.` },
            { status: 409 },
        );
    }
    await GroupMember.updateOne(
        { groupID: group._id, userID: request.user._id },
        { $setOnInsert: { role: "member" } },
        { upsert: true },
    );
    return NextResponse.json({ groupId }, { status: 201, headers: noStore });
});
