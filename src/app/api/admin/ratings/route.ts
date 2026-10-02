import { NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import connectDB from "../../../db/connectDB";
import { guestName } from "../../../lib/activity";
import { resolvePlan } from "../../../lib/plan-config";
import { RATING_SCORES, type RatingCounts, type RatingScore } from "../../../lib/rating";
import ProductSignal from "../../../models/ProductSignal";
import Rating from "../../../models/Rating";
import User from "../../../models/User";

const DAYS = 30;
const RECENT = 60;

type RatingRow = {
    _id: unknown;
    score: RatingScore;
    surface: string;
    context?: string;
    comment?: string;
    userID?: unknown;
    visitorKey: string;
    createdAt: Date;
};

/** Answers to "How is Expansive Mind doing?" over the last 30 days. */
export const GET = withAdmin(async () => {
    await connectDB();
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1_000);
    const [grouped, shown, recent] = await Promise.all([
        Rating.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: "$score", count: { $sum: 1 } } },
        ]),
        ProductSignal.aggregate([
            { $match: { key: "rating_prompt_shown", day: { $gte: since.toISOString().slice(0, 10) } } },
            { $group: { _id: null, count: { $sum: "$count" } } },
        ]),
        Rating.find({ createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .limit(RECENT)
            .lean<RatingRow[]>(),
    ]);

    const counts = Object.fromEntries(RATING_SCORES.map((score) => [score, 0])) as RatingCounts;
    for (const row of grouped as Array<{ _id: string; count: number }>) {
        if (row._id in counts) counts[row._id as RatingScore] = Number(row.count || 0);
    }

    const accounts = await User.find({
        _id: { $in: [...new Set(recent.flatMap((row) => (row.userID ? [String(row.userID)] : [])))] },
    })
        .select("firstName lastName email plan accessOverride subscriptionStatus")
        .lean<Array<{
            _id: unknown;
            firstName?: string;
            lastName?: string;
            email?: string;
            plan?: string;
            accessOverride?: string | null;
            subscriptionStatus?: string;
        }>>();
    const accountById = new Map(accounts.map((account) => [String(account._id), account]));

    return NextResponse.json(
        {
            days: DAYS,
            counts,
            shown: Number(shown[0]?.count || 0),
            recent: recent.map((row) => {
                const account = row.userID ? accountById.get(String(row.userID)) : undefined;
                return {
                    id: String(row._id),
                    score: row.score,
                    surface: row.surface,
                    context: row.context || "",
                    comment: row.comment || "",
                    createdAt: row.createdAt,
                    person: account ? `user:${String(account._id)}` : `guest:${row.visitorKey}`,
                    who: account
                        ? [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email || "Account"
                        : guestName(row.visitorKey),
                    plan: account
                        ? resolvePlan({ ...account, accessOverride: account.accessOverride ?? undefined })
                        : "guest",
                };
            }),
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
