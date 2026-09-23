import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import { allowancesForUsers } from "../../../lib/account-usage-report";
import User from "../../../models/User";
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

    const allowances = await allowancesForUsers(users);
    const usageByUser = new Map(
        allowances.map((account) => [account.id, account.features]),
    );

    return NextResponse.json(
        {
            users: users.map((user) => ({
                ...user,
                _id: String(user._id),
                effectivePlan: resolvePlan(user),
                usage: usageByUser.get(String(user._id)) || [],
            })),
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            total,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
