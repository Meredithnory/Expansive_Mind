import { NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import connectDB from "../../../db/connectDB";
import { LIMIT_FEATURE_LABEL, isLimitAlertFeature } from "../../../lib/limit-alert-mail";
import { resolvePlan } from "../../../lib/plan-config";
import { formatQuotaPeriod, monthKey } from "../../../lib/quota-period";
import LimitAlert from "../../../models/LimitAlert";
import User from "../../../models/User";

type AlertRow = {
    userID: unknown;
    feature: string;
    limit: number;
    used: number;
    blocked?: boolean;
    emailed?: boolean;
    requestedAt?: Date;
    requestNote?: string;
    firstAt: Date;
    lastAt: Date;
};

type Account = {
    _id: unknown;
    firstName?: string;
    lastName?: string;
    email?: string;
    plan?: string;
    accessOverride?: string | null;
    subscriptionStatus?: string;
};

/** People who used up a monthly allowance this month, most recent first. */
export const GET = withAdmin(async () => {
    await connectDB();
    const period = monthKey(new Date());
    const alerts = await LimitAlert.find({ period })
        .sort({ lastAt: -1 })
        .limit(200)
        .lean<AlertRow[]>();
    const ids = [...new Set(alerts.map((alert) => String(alert.userID)))];
    const accounts = ids.length
        ? await User.find({ _id: { $in: ids } })
              .select("firstName lastName email plan accessOverride subscriptionStatus")
              .lean<Account[]>()
        : [];
    const accountById = new Map(accounts.map((account) => [String(account._id), account]));

    const people = new Map<
        string,
        {
            userId: string;
            name: string;
            email: string;
            plan: string;
            lastAt: string;
            features: Array<{ feature: string; label: string; used: number; limit: number; blocked: boolean }>;
            /** "Ask for more" from the limit pop-up: when, and their note. */
            requests: Array<{ label: string; at: string; note: string }>;
        }
    >();
    for (const alert of alerts) {
        if (!isLimitAlertFeature(alert.feature)) continue;
        const userId = String(alert.userID);
        const account = accountById.get(userId);
        if (!account) continue;
        const person = people.get(userId) ?? {
            userId,
            name: [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email || "Account",
            email: account.email || "",
            plan: resolvePlan({ ...account, accessOverride: account.accessOverride ?? undefined }),
            lastAt: new Date(alert.lastAt).toISOString(),
            features: [],
            requests: [],
        };
        person.features.push({
            feature: alert.feature,
            label: LIMIT_FEATURE_LABEL[alert.feature],
            used: alert.used,
            limit: alert.limit,
            blocked: Boolean(alert.blocked),
        });
        if (alert.requestedAt) {
            person.requests.push({
                label: LIMIT_FEATURE_LABEL[alert.feature],
                at: new Date(alert.requestedAt).toISOString(),
                note: alert.requestNote || "",
            });
        }
        people.set(userId, person);
    }

    return NextResponse.json(
        { month: formatQuotaPeriod(period), people: [...people.values()] },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
