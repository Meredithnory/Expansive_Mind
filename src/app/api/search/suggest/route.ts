import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import {
    queriesMatch,
    suggestSearchQuery,
} from "../spell-suggest";
import { consumeRateLimit } from "../../../lib/rate-limit";

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

        if (!query || query.length > 300) {
            return NextResponse.json(
                { error: "Missing search query parameter 'q'" },
                { status: 400 },
            );
        }

        // Suggestions should not make a second, unmetered AI request. NIH's
        // spelling endpoint is sufficient for this optional UI affordance.
        const suggestedQuery = await suggestSearchQuery(query, {
            allowAi: false,
        });

        if (!suggestedQuery || queriesMatch(suggestedQuery, query)) {
            return NextResponse.json({
                originalQuery: query,
                suggestedQuery: null,
                suggestedTotalCount: 0,
            });
        }

        return NextResponse.json({
            originalQuery: query,
            suggestedQuery,
            // Avoid a second full provider search for optional suggestion UI.
            // The real search remains quota-checked when the user accepts it.
            suggestedTotalCount: 0,
        });
    } catch {
        console.error("Search suggestion request failed");
        return NextResponse.json(
            { error: "Failed to suggest search query" },
            { status: 500 },
        );
    }
});
