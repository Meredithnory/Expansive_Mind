import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../../authMiddleware";
import { consumeRateLimit, requestIp } from "../../../lib/rate-limit";
import { assessDiscoveryQuestion } from "../assess-query";

export const GET = withOptionalAuth(async (req: NextRequest) => {
    try {
        const identity = req.user?._id?.toString() || requestIp(req);
        const rateLimit = await consumeRateLimit({
            scope: "discover-suggest",
            identity,
            limit: req.user ? 20 : 8,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Spelling check rate limit reached." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
        if (!query || query.length > 2_000) {
            return NextResponse.json(
                { error: "A research question of 1–2000 characters is required." },
                { status: 400 },
            );
        }

        const assessment = await assessDiscoveryQuestion(query);
        return NextResponse.json({
            originalQuery: query,
            status: assessment.status,
            suggestedQuery: assessment.suggestion,
        });
    } catch {
        console.error("Discovery suggestion request failed");
        return NextResponse.json(
            { error: "Failed to check the research question." },
            { status: 500 },
        );
    }
});
