import mongoose from "mongoose";
import Group from "../../models/Group";
import GroupMember from "../../models/GroupMember";

export type GroupRole = "owner" | "member";

/**
 * The caller's membership in a group, or null. Every group route goes
 * through this, so non-members get the same 404 as a missing group.
 */
export async function loadMembership(groupId: string, userID: unknown) {
    if (!mongoose.isValidObjectId(groupId)) return null;
    const [group, member] = await Promise.all([
        Group.findById(groupId).lean(),
        GroupMember.findOne({ groupID: groupId, userID }).lean(),
    ]);
    if (!group || !member) return null;
    return {
        group: group as unknown as {
            _id: mongoose.Types.ObjectId;
            name: string;
            ownerID: mongoose.Types.ObjectId;
            inviteCode: string;
            createdAt: Date;
        },
        role: (member as unknown as { role: GroupRole }).role,
    };
}

export function authorView(user: {
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
    profileColor?: string;
} | null | undefined) {
    if (!user) return { id: "", name: "Former member", profileColor: null };
    return {
        id: user._id.toString(),
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Member",
        profileColor: user.profileColor || null,
    };
}
