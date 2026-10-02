import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "64b000000000000000000001";
const ADMIN_ID = "64b0000000000000000000aa";

const mocks = vi.hoisted(() => {
    const deleted = (n: number) => vi.fn().mockResolvedValue({ deletedCount: n });
    const updated = (n: number) =>
        vi.fn().mockResolvedValue({ modifiedCount: n });
    return {
        userFindById: vi.fn(),
        userDeleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
        savedPaperFind: vi.fn(),
        savedPaperDeleteMany: deleted(2),
        messageDeleteMany: deleted(5),
        usageCounterDeleteMany: deleted(3),
        projectDeleteMany: deleted(1),
        highlightDeleteMany: deleted(4),
        discoveryDeleteMany: deleted(2),
        briefDeleteMany: deleted(1),
        shareDeleteMany: deleted(1),
        usageEventUpdateMany: updated(7),
        engagementUpdateMany: updated(6),
        recordAdminAction: vi.fn().mockResolvedValue(undefined),
        stripeCancel: vi.fn(),
        userUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
        sendEmail: vi.fn().mockResolvedValue({ accepted: true, status: 200, id: "e1" }),
        adminEmailCreate: vi.fn().mockResolvedValue({}),
    };
});

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/admin", () => ({
    withAdmin: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../../lib/admin-audit", () => ({
    recordAdminAction: mocks.recordAdminAction,
}));
vi.mock("../../../../lib/stripe", () => ({
    getStripe: () => ({ subscriptions: { cancel: mocks.stripeCancel } }),
}));
vi.mock("../../../../models/User", () => ({
    default: { findById: mocks.userFindById, deleteOne: mocks.userDeleteOne, updateOne: mocks.userUpdateOne },
}));
vi.mock("../../../../lib/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("../../../../models/AdminEmail", () => ({ default: { create: mocks.adminEmailCreate } }));
vi.mock("../../../../lib/plan-config", () => ({
    getPlanConfig: () =>
        Promise.resolve({ entitlements: { pro: { discover: 20, search: 300, scholar_search: 25, chat: 100, projects: 50 } } }),
}));
vi.mock("../../../../models/SavedPaper", () => ({
    default: {
        find: mocks.savedPaperFind,
        deleteMany: mocks.savedPaperDeleteMany,
    },
}));
vi.mock("../../../../models/Message", () => ({
    default: { deleteMany: mocks.messageDeleteMany },
}));
vi.mock("../../../../models/UsageCounter", () => ({
    default: { deleteMany: mocks.usageCounterDeleteMany },
}));
vi.mock("../../../../models/Project", () => ({
    default: { deleteMany: mocks.projectDeleteMany },
}));
vi.mock("../../../../models/PaperHighlight", () => ({
    default: { deleteMany: mocks.highlightDeleteMany },
}));
vi.mock("../../../../models/SavedDiscovery", () => ({
    default: { deleteMany: mocks.discoveryDeleteMany },
}));
vi.mock("../../../../models/PaperBrief", () => ({
    default: { deleteMany: mocks.briefDeleteMany },
}));
vi.mock("../../../../models/PaperShare", () => ({
    default: { deleteMany: mocks.shareDeleteMany },
}));
vi.mock("../../../../models/Group", () => ({
    default: {
        find: () => ({ select: () => ({ lean: () => Promise.resolve([{ _id: "g1" }]) }) }),
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    },
}));
vi.mock("../../../../models/GroupComment", () => ({
    default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 3 }) },
}));
vi.mock("../../../../models/GroupPost", () => ({
    default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }) },
}));
vi.mock("../../../../models/GroupMember", () => ({
    default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 4 }) },
}));
vi.mock("../../../../models/Block", () => ({ default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) } }));
vi.mock("../../../../models/Follow", () => ({ default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) } }));
vi.mock("../../../../models/ForumReport", () => ({ default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) } }));
vi.mock("../../../../models/ForumPost", () => ({ default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 5 }) } }));
vi.mock("../../../../models/ForumComment", () => ({ default: { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 6 }) } }));
vi.mock("../../../../models/UsageEvent", () => ({
    default: { updateMany: mocks.usageEventUpdateMany },
}));
vi.mock("../../../../models/PageEngagement", () => ({
    default: { updateMany: mocks.engagementUpdateMany },
}));

import { POST } from "./route";

function request(body: unknown) {
    const next = new NextRequest("https://example.test/api/admin/users/actions", {
        method: "POST",
        headers: {
            origin: "https://example.test",
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
    next.user = {
        _id: { toString: () => ADMIN_ID },
        email: "admin@example.test",
    };
    return next;
}

describe("POST /api/admin/users/actions remove_user", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userFindById.mockResolvedValue({
            _id: USER_ID,
            email: "friend@berkeley.edu",
            stripeSubscriptionId: null,
            stripeCustomerId: null,
        });
        mocks.savedPaperFind.mockReturnValue({
            select: () => ({ lean: () => Promise.resolve([{ _id: "p1" }]) }),
        });
    });

    it("needs the action repeated as confirmation", async () => {
        const response = await POST(
            request({ action: "remove_user", userId: USER_ID }),
        );
        expect(response.status).toBe(400);
        expect(mocks.userDeleteOne).not.toHaveBeenCalled();
    });

    it("refuses to delete the signed-in admin", async () => {
        const response = await POST(
            request({
                action: "remove_user",
                confirm: "remove_user",
                userId: ADMIN_ID,
            }),
        );
        expect(response.status).toBe(409);
        expect(mocks.userDeleteOne).not.toHaveBeenCalled();
    });

    it("erases the user's content and unlinks usage history", async () => {
        const response = await POST(
            request({
                action: "remove_user",
                confirm: "remove_user",
                userId: USER_ID,
            }),
        );
        expect(response.status).toBe(200);
        const body = await response.json();

        expect(mocks.userDeleteOne).toHaveBeenCalledWith({ _id: USER_ID });
        expect(mocks.messageDeleteMany).toHaveBeenCalledWith({
            savedPaperID: { $in: ["p1"] },
        });
        for (const deleteMany of [
            mocks.savedPaperDeleteMany,
            mocks.usageCounterDeleteMany,
            mocks.projectDeleteMany,
            mocks.highlightDeleteMany,
            mocks.discoveryDeleteMany,
            mocks.briefDeleteMany,
        ]) {
            expect(deleteMany).toHaveBeenCalledWith({ userID: USER_ID });
        }
        expect(mocks.shareDeleteMany).toHaveBeenCalledWith({ ownerID: USER_ID });
        expect(mocks.usageEventUpdateMany).toHaveBeenCalledWith(
            { userID: USER_ID },
            { $unset: { userID: "" } },
        );
        expect(mocks.engagementUpdateMany).toHaveBeenCalledWith(
            { userID: USER_ID },
            { $unset: { userID: "" } },
        );
        expect(body.result.deleted).toMatchObject({
            usageEventsAnonymized: 7,
            visitsAnonymized: 6,
            groupsOwned: 1,
            groupPosts: 2,
            groupComments: 3,
            groupMemberships: 4,
            forumPosts: 5,
            forumComments: 6,
            user: 1,
        });
        expect(mocks.stripeCancel).not.toHaveBeenCalled();
        expect(mocks.recordAdminAction).toHaveBeenCalledWith(
            expect.objectContaining({ action: "user.remove_user" }),
        );
    });
});

describe("POST /api/admin/users/actions grant_pro", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userFindById.mockResolvedValue({
            _id: USER_ID,
            firstName: "Ada",
            email: "ada@lab.edu",
            accessOverride: null,
        });
        mocks.sendEmail.mockResolvedValue({ accepted: true, status: 200, id: "e1" });
    });

    it("grants Pro and emails what it includes, logged in Admin email history", async () => {
        const response = await POST(request({ action: "grant_pro", confirm: "grant_pro", userId: USER_ID }));
        expect((await response.json()).result).toEqual({ accessOverride: "pro", emailed: true });
        expect(mocks.userUpdateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $set: { accessOverride: "pro" } });
        const mail = mocks.sendEmail.mock.calls[0][0];
        expect(mail).toMatchObject({ to: "ada@lab.edu", subject: "You have Researcher Pro on Expansive Mind, at no cost" });
        expect(mail.text).toContain("20 discoveries");
        expect(mocks.adminEmailCreate).toHaveBeenCalledWith(
            expect.objectContaining({ audience: "one", userID: USER_ID, recipients: 1, sent: 1, sentBy: "admin@example.test" }),
        );
    });

    it("sends nothing when the box is unticked or they already had Pro", async () => {
        await POST(request({ action: "grant_pro", confirm: "grant_pro", userId: USER_ID, notify: false }));
        mocks.userFindById.mockResolvedValue({ _id: USER_ID, firstName: "Ada", email: "ada@lab.edu", accessOverride: "pro" });
        await POST(request({ action: "grant_pro", confirm: "grant_pro", userId: USER_ID }));
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("says so when the email didn't go out", async () => {
        mocks.sendEmail.mockResolvedValue({ accepted: false, status: null, id: null });
        const response = await POST(request({ action: "grant_pro", confirm: "grant_pro", userId: USER_ID }));
        expect((await response.json()).result.emailed).toBe(false);
    });

    it("never emails when Pro is removed", async () => {
        mocks.userFindById.mockResolvedValue({ _id: USER_ID, firstName: "Ada", email: "ada@lab.edu", accessOverride: "pro" });
        await POST(request({ action: "revoke_pro", confirm: "revoke_pro", userId: USER_ID }));
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
});
