import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import {
    getCombinedSearchTotalCount,
    type SourceFilter,
} from "../utils";
import {
    queriesMatch,
    suggestSearchQuery,
} from "../spell-suggest";
import { consumeRateLimit } from "../../../lib/rate-limit";

const parseSourceFilter = (value: string | null): SourceFilter => {
    if (value === "nih" || value === "springer" || value === "scholar") {
        return value;
    }
    return "all";
};

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const rateLimit = await consumeRateLimit({
            scope: "search-suggest",
            identity: req.user._id.toString(),
            limit: 10,
            windowMs: 10 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Search suggestion rate limit reached." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }
        const query = req.nextUrl.searchParams.get("q")?.trim();
        const sourceFilter = parseSourceFilter(
            req.nextUrl.searchParams.get("source"),
        );

        if (!query || query.length > 300) {
            return NextResponse.json(
                { error: "Missing search query parameter 'q'" },
                { status: 400 },
            );
        }

        const suggestedQuery = await suggestSearchQuery(query);

        if (!suggestedQuery || queriesMatch(suggestedQuery, query)) {
            return NextResponse.json({
                originalQuery: query,
                suggestedQuery: null,
                suggestedTotalCount: 0,
            });
        }

        const suggestedTotalCount = await getCombinedSearchTotalCount(
            suggestedQuery,
            sourceFilter,
        );

        return NextResponse.json({
            originalQuery: query,
            suggestedQuery,
            suggestedTotalCount,
        });
    } catch {
        console.error("Search suggestion request failed");
        return NextResponse.json(
            { error: "Failed to suggest search query" },
            { status: 500 },
        );
    }
});
