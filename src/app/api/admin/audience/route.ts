import { NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import connectDB from "../../../db/connectDB";
import PageEngagement from "../../../models/PageEngagement";
import User from "../../../models/User";
import { summarizeAudience, type AudienceRecord } from "../../../lib/audience";

export const GET = withAdmin(async () => {
    const end = new Date();
    const since = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1_000)
        .toISOString()
        .slice(0, 10);
    await connectDB();
    const rows = await PageEngagement.find({ day: { $gte: since } })
        .select("visitorKey userID day secondsByPage moves")
        .limit(8_000)
        .lean<
            Array<{
                visitorKey: string;
                userID?: unknown;
                day: string;
                secondsByPage?: Record<string, number>;
                moves?: Record<string, number>;
            }>
        >();
    const userIds = [
        ...new Set(
            rows
                .map((row) => (row.userID ? String(row.userID) : ""))
                .filter(Boolean),
        ),
    ];
    const accounts = userIds.length
        ? await User.find({ _id: { $in: userIds } })
              .select("firstName lastName email plan")
              .lean<
                  Array<{
                      _id: { toString(): string };
                      firstName?: string;
                      lastName?: string;
                      email?: string;
                      plan?: string;
                  }>
              >()
        : [];
    const accountById = new Map(
        accounts.map((account) => [String(account._id), account]),
    );
    const records: AudienceRecord[] = rows.map((row) => {
        const userId = row.userID ? String(row.userID) : undefined;
        const account = userId ? accountById.get(userId) : undefined;
        return {
            day: row.day,
            visitorKey: row.visitorKey,
            userId,
            signedIn: Boolean(userId),
            account: account
                ? {
                      name: [account.firstName, account.lastName]
                          .filter(Boolean)
                          .join(" "),
                      email: account.email || "",
                      plan: account.plan || "free",
                  }
                : undefined,
            secondsByPage: row.secondsByPage,
            moves: row.moves,
        };
    });
    return NextResponse.json(summarizeAudience(records, 30, end), {
        headers: { "Cache-Control": "private, no-store" },
    });
});
