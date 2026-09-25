import "server-only";
import connectDB from "../db/connectDB";
import UsageCounter from "../models/UsageCounter";
import User from "../models/User";
import { getPlanConfig } from "./plan-config";
import {
    buildAccountQuota,
    buildMonthlyQuota,
    type AccountQuotaRow,
    type MonthlyQuotaRow,
} from "./account-usage";
import { monthKey } from "./quota-period";

type StoredUser = {
    _id: unknown;
    firstName?: string;
    lastName?: string;
    email?: string;
    plan?: string;
    subscriptionStatus?: string;
    accessOverride?: string | null;
};

function asAccount(user: StoredUser) {
    return {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        accessOverride: user.accessOverride,
    };
}

export async function allowancesForUsers(
    users: StoredUser[],
    now = new Date(),
): Promise<AccountQuotaRow[]> {
    if (users.length === 0) return [];
    await connectDB();
    const config = await getPlanConfig();
    const counters = await UsageCounter.find({
        userID: { $in: users.map((user) => user._id) },
        period: { $in: [monthKey(now), "lifetime"] },
    })
        .select("userID feature period count")
        .lean<
            Array<{
                userID: unknown;
                feature: string;
                period: string;
                count: number;
            }>
        >();

    return buildAccountQuota({
        users: users.map(asAccount),
        counters: counters.map((counter) => ({
            userID: String(counter.userID),
            feature: counter.feature,
            period: counter.period,
            count: counter.count,
        })),
        entitlements: config.entitlements,
        now,
    });
}

export async function loadQuotaReport(now = new Date()): Promise<{
    month: string;
    months: MonthlyQuotaRow[];
    accounts: AccountQuotaRow[];
}> {
    await connectDB();
    const month = monthKey(now);
    const earliest = monthKey(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)),
    );
    const [users, history] = await Promise.all([
        User.find({})
            .select(
                "firstName lastName email plan accessOverride subscriptionStatus",
            )
            .sort({ submittedAt: -1 })
            .limit(200)
            .lean<StoredUser[]>(),
        UsageCounter.aggregate<{
            _id: { period: string; feature: string };
            used: number;
        }>([
            {
                $match: {
                    userID: { $exists: true, $ne: null },
                    period: {
                        $gte: earliest,
                        $lte: month,
                        $regex: /^\d{4}-\d{2}$/,
                    },
                },
            },
            {
                $group: {
                    _id: { period: "$period", feature: "$feature" },
                    used: { $sum: "$count" },
                },
            },
        ]),
    ]);

    const accounts = await allowancesForUsers(users, now);
    return {
        month,
        months: buildMonthlyQuota(
            history.map((row) => ({
                period: row._id.period,
                feature: row._id.feature,
                used: row.used,
            })),
            now,
        ),
        accounts,
    };
}
