import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import {
    getAutocompleteSuggestion,
    queriesMatch,
} from "../spell-suggest";
import { consumeRateLimit } from "../../../lib/rate-limit";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const rateLimit = await consumeRateLimit({
            scope: "autocomplete",
            identity: req.user._id.toString(),
            limit: 12,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Autocomplete rate limit reached." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }
        const query = req.nextUrl.searchParams.get("q")?.trim();

        if (!query || query.length > 200) {
            return NextResponse.json(
                { error: "Missing search query parameter 'q'" },
                { status: 400 },
            );
        }

        const completion = await getAutocompleteSuggestion(query);

        if (!completion || queriesMatch(completion, query)) {
            return NextResponse.json({ query, completion: null });
        }

        return NextResponse.json({ query, completion });
    } catch {
        console.error("Autocomplete request failed");
        return NextResponse.json(
            { error: "Failed to autocomplete search query" },
            { status: 500 },
        );
    }
});
