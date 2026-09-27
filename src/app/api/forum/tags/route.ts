import { NextResponse } from "next/server";
import connectDB from "../../../db/connectDB";
import ForumPost from "../../../models/ForumPost";

// Most-used tags on visible posts from the last 30 days.
export async function GET() {
    await connectDB();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = (await ForumPost.aggregate([
        { $match: { status: "visible", createdAt: { $gte: since } } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 12 },
    ])) as Array<{ _id: string; count: number }>;
    return NextResponse.json(
        { tags: rows.map((row) => ({ tag: row._id, count: row.count })) },
        { headers: { "Cache-Control": "public, max-age=300" } },
    );
}
