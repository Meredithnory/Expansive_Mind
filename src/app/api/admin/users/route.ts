import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import User from "../../../models/User";
import UsageCounter from "../../../models/UsageCounter";
import { resolvePlan } from "../../../lib/plan-config";

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withAdmin(async (request: NextRequest) => {
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
    const page = Math.max(
        1,
        Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1,
    );
    const limit = 25;
    const filter = query
        ? {
              $or: [
                  { email: { $regex: escapeRegExp(query), $options: "i" } },
                  { firstName: { $regex: escapeRegExp(query), $options: "i" } },
                  { lastName: { $regex: escapeRegExp(query), $options: "i" } },
              ],
          }
        : {};

    const [users, total] = await Promise.all([
        User.find(filter)
            .select(
                "firstName lastName email plan accessOverride subscriptionStatus stripeCustomerId stripeSubscriptionId stripePriceId subscriptionCurrentPeriodEnd submittedAt",
            )
            .sort({ submittedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean<any[]>(),
        User.countDocuments(filter),
    ]);

    const ids = users.map((user) => user._id);
    const usage = await UsageCounter.aggregate([
        { $match: { userID: { $in: ids } } },
        {
            $group: {
                _id: { userID: "$userID", feature: "$feature" },
                used: { $sum: "$count" },
            },
        },
    ]);
    const usageByUser = usage.reduce<Record<string, Record<string, number>>>(
        (result, row) => {
            const id = String(row._id.userID);
            result[id] ||= {};
            result[id][row._id.feature] = row.used;
            return result;
        },
        {},
    );

    return NextResponse.json(
        {
            users: users.map((user) => ({
                ...user,
                _id: String(user._id),
                effectivePlan: resolvePlan(user),
                usage: usageByUser[String(user._id)] || {},
            })),
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            total,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
