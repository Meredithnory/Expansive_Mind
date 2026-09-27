import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../authMiddleware";
import Group from "../../models/Group";
import GroupMember from "../../models/GroupMember";
import { hasValidMutationOrigin } from "../../lib/request-security";
import { consumeRateLimit } from "../../lib/rate-limit";
import {
    GROUPS_PER_USER_LIMIT,
    newInviteCode,
    parseGroupName,
} from "../../lib/groups";

const noStore = { "Cache-Control": "private, no-store" };

export const GET = withAuth(async (request: NextRequest) => {
    const memberships = (await GroupMember.find({ userID: request.user._id })
        .sort({ createdAt: -1 })
        .lean()) as unknown as Array<{ groupID: unknown; role: string }>;
    const groupIds = memberships.map((item) => item.groupID);
    const [groups, counts] = await Promise.all([
        Group.find({ _id: { $in: groupIds } }).lean(),
        GroupMember.aggregate([
            { $match: { groupID: { $in: groupIds } } },
            { $group: { _id: "$groupID", count: { $sum: 1 } } },
        ]),
    ]);
    const byId = new Map(
        (groups as unknown as Array<{ _id: { toString(): string }; name: string }>).map(
            (group) => [group._id.toString(), group],
        ),
    );
    const countById = new Map(
        (counts as Array<{ _id: { toString(): string }; count: number }>).map(
            (row) => [row._id.toString(), row.count],
        ),
    );
    return NextResponse.json(
        {
            groups: memberships
                .map((membership) => {
                    const id = String(membership.groupID);
                    const group = byId.get(id);
                    if (!group) return null;
                    return {
                        id,
                        name: group.name,
                        role: membership.role,
                        memberCount: countById.get(id) || 1,
                    };
                })
                .filter(Boolean),
        },
        { headers: noStore },
    );
});

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const rateLimit = await consumeRateLimit({
        scope: "groups-create",
        identity: request.user._id.toString(),
        limit: 10,
        windowMs: 60 * 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "You've created a lot of groups recently. Try again later." },
            { status: 429 },
        );
    }
    const body = await request.json().catch(() => null);
    const name = parseGroupName(body?.name);
    if (!name) {
        return NextResponse.json(
            { error: "Give the group a name (up to 60 characters)." },
            { status: 400 },
        );
    }
    const existing = await GroupMember.countDocuments({ userID: request.user._id });
    if (existing >= GROUPS_PER_USER_LIMIT) {
        return NextResponse.json(
            { error: `You can be in up to ${GROUPS_PER_USER_LIMIT} groups.` },
            { status: 409 },
        );
    }
    const group = await Group.create({
        name,
        ownerID: request.user._id,
        inviteCode: newInviteCode(),
    });
    await GroupMember.create({
        groupID: group._id,
        userID: request.user._id,
        role: "owner",
    });
    return NextResponse.json(
        { group: { id: group._id.toString(), name, role: "owner", memberCount: 1 } },
        { status: 201, headers: noStore },
    );
});
