import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import { resolvePlan } from "../../lib/entitlements";
import { normalizePaperDoi } from "../../lib/paper-impact";
import {
    CITING_WORKS_MAX_PAGE_SIZE,
    CITING_WORKS_PAGE_SIZE,
    parseScholarCitesId,
} from "../../lib/citing-works";
import { lookupCitingWorks } from "../../lib/citing-works-lookup";

export const GET = withOptionalAuth(async (req: NextRequest) => {
    const plan = resolvePlan(req.user);
    const identity = req.user?._id?.toString() || requestIp(req);
    const rateLimit = await consumeRateLimit({
        scope: "citing-works",
        identity,
        limit: plan === "guest" ? 12 : 40,
        windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many citation lookups. Please try again shortly." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rateLimit.retryAfterSeconds),
                },
            },
        );
    }

    const doi = normalizePaperDoi(req.nextUrl.searchParams.get("doi"));
    const scholarCitesId = parseScholarCitesId(
        req.nextUrl.searchParams.get("citesId"),
    );
    const limitRaw = Number.parseInt(
        req.nextUrl.searchParams.get("limit") || "",
        10,
    );
    const offsetRaw = Number.parseInt(
        req.nextUrl.searchParams.get("offset") || "",
        10,
    );
    const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), CITING_WORKS_MAX_PAGE_SIZE)
        : CITING_WORKS_PAGE_SIZE;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    if (!doi && !scholarCitesId) {
        return NextResponse.json({
            works: [],
            total: 0,
            hasMore: false,
            source: null,
            unavailableReason:
                "Citing papers are not available. Search results only include a citation count, and this paper has no Scholar cites id or DOI to fetch the list.",
        });
    }

    const result = await lookupCitingWorks({
        doi,
        scholarCitesId,
        limit,
        offset,
    });

    return NextResponse.json(result);
});
