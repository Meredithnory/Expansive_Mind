import { NextRequest, NextResponse } from "next/server";
import {
    mergeResultsByTier,
    searchEuropePmcPapers,
    searchCrossrefPapers,
} from "./utils";
import { rankSearchResults } from "./semantic-rank";
import { searchHomed } from "../research/registry";
import type { SourceDatabase } from "../../lib/paper-sources";
import { attachPaperImpact } from "../../lib/paper-impact-lookup";
import { withOptionalAuth } from "../authMiddleware";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import {
    consumeQuota,
    getPlanEntitlements,
    resolvePlan,
} from "../../lib/entitlements";
import { cached } from "../../lib/provider-cache";
import {
    deferUsageRecording,
    type UsageContext,
} from "../../lib/usage-meter";
import { isAdminUser } from "../../lib/admin";
import { consumeGuestDailyCap } from "../../lib/guest-cost-cap";

type SourceFilter = "all" | "nih" | "springer" | "scholar" | "europe-pmc" | "crossref";

const getSourceFlags = (sourceFilter: string) => ({
    includeNih: sourceFilter === "all" || sourceFilter === "nih",
    includeSpringer: sourceFilter === "all" || sourceFilter === "springer",
    includeScholar: sourceFilter === "scholar",
});

async function runSearch(
    searchValue: string,
    page: number,
    sourceFilter: string,
    options?: { lightweight?: boolean; usageContext?: UsageContext },
) {
    const lightweight = options?.lightweight ?? false;

    // Explicit index sources from the research UX branch.
    if (sourceFilter === "europe-pmc") {
        const europe = await searchEuropePmcPapers(searchValue, page);
        const europeResults = europe.results.filter(
            (result: (typeof europe.results)[number]): result is NonNullable<
                (typeof europe.results)[number]
            > => result != null,
        );
        const results = lightweight
            ? europeResults
            : await rankSearchResults(
                  searchValue,
                  europeResults,
                  options?.usageContext,
              );
        const withImpact = lightweight
            ? results
            : await attachPaperImpact(results);
        return {
            results: withImpact,
            totalCount: europe.totalCount,
            totalPages: europe.totalPages,
            warnings: [] as string[],
            callCount: 1,
        };
    }
    if (sourceFilter === "crossref") {
        const crossref = await searchCrossrefPapers(searchValue, page);
        const crossrefResults = crossref.results.filter(
            (result: (typeof crossref.results)[number]): result is NonNullable<
                (typeof crossref.results)[number]
            > => result != null,
        );
        const results = lightweight
            ? crossrefResults
            : await rankSearchResults(
                  searchValue,
                  crossrefResults,
                  options?.usageContext,
              );
        const withImpact = lightweight
            ? results
            : await attachPaperImpact(results);
        return {
            results: withImpact,
            totalCount: crossref.totalCount,
            totalPages: crossref.totalPages,
            warnings: [] as string[],
            callCount: 1,
        };
    }

    const { includeNih, includeSpringer, includeScholar } =
        getSourceFlags(sourceFilter);
    const databases: SourceDatabase[] = [
        ...(includeNih ? (["nih"] as const) : []),
        ...(includeSpringer ? (["springer"] as const) : []),
        ...(includeScholar ? (["scholar"] as const) : []),
    ];

    const found = await searchHomed({
        query: searchValue,
        page,
        databases,
        hydrate: !lightweight,
    });

    let groups = found.byDatabase.map((group) => group.hits);
    let totalCount = found.totalCount;
    let totalPages = found.totalPages;
    let warnings = found.warnings;
    let callCount = found.callCount;

    // On "all", also fold Europe PMC + Crossref index hits into the workspace.
    if (sourceFilter === "all") {
        const [europe, crossref] = await Promise.all([
            searchEuropePmcPapers(searchValue, page),
            searchCrossrefPapers(searchValue, page),
        ]);
        const europeResults = europe.results.filter(
            (result: (typeof europe.results)[number]): result is NonNullable<
                (typeof europe.results)[number]
            > => result != null,
        );
        const crossrefResults = crossref.results.filter(
            (result: (typeof crossref.results)[number]): result is NonNullable<
                (typeof crossref.results)[number]
            > => result != null,
        );
        groups = [...groups, europeResults, crossrefResults];
        totalCount += europe.totalCount + crossref.totalCount;
        totalPages = Math.max(totalPages, europe.totalPages, crossref.totalPages);
        callCount += 2;
    }

    const mergedResults =
        groups.length > 1 ? mergeResultsByTier(...groups) : groups[0] || [];
    const paperResults = lightweight
        ? mergedResults
        : await rankSearchResults(
              searchValue,
              mergedResults,
              options?.usageContext,
          );
    const withImpact = lightweight
        ? paperResults
        : await attachPaperImpact(paperResults);

    return {
        results: withImpact,
        totalCount,
        totalPages,
        warnings,
        callCount,
    };
}

export const GET = withOptionalAuth(async (req: NextRequest) => {
    try {
        const plan = resolvePlan(req.user);
        const isAdmin = isAdminUser(req.user);
        const identity = req.user?._id?.toString() || requestIp(req);
        const userID = req.user?._id?.toString();
        const rateLimit = await consumeRateLimit({
            scope: "search",
            identity,
            limit: plan === "guest" ? 6 : 30,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many searches. Please try again shortly." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }
        const searchValue = req.nextUrl.searchParams.get("q");
        const page = parseInt(req.nextUrl.searchParams.get("page") || "0", 10);
        const sourceFilter =
            (req.nextUrl.searchParams.get("source") as SourceFilter) || "all";

        if (!searchValue || searchValue.trim().length > 300) {
            throw Error("Invalid search value.");
        }

        if (
            !["all", "nih", "springer", "scholar", "europe-pmc", "crossref"].includes(sourceFilter) ||
            page < 0 ||
            page > 100
        ) {
            return NextResponse.json(
                { error: "Invalid search options." },
                { status: 400 },
            );
        }

        if (!req.user) {
            const dailyCap = await consumeGuestDailyCap(req, "search");
            if (!dailyCap.allowed) {
                return NextResponse.json(
                    {
                        error: "That's the guest search limit for today.",
                        code: "DAILY_CAP_REACHED",
                    },
                    {
                        status: 429,
                        headers: {
                            "Retry-After": String(
                                dailyCap.retryAfterSeconds,
                            ),
                        },
                    },
                );
            }
        }

        const entitlements = await getPlanEntitlements(plan);
        if (
            sourceFilter === "scholar" &&
            entitlements.scholar_search <= 0 &&
            !isAdmin
        ) {
            return NextResponse.json(
                {
                    error: "Google Scholar search is available with Researcher Pro.",
                    code: "PRO_REQUIRED",
                },
                { status: 403 },
            );
        }

        const quota = await consumeQuota({
            plan,
            feature: "search",
            identity,
            userID,
            unlimited: isAdmin,
        });
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error:
                        plan === "guest"
                            ? "Daily guest search limit reached."
                            : "Monthly search limit reached.",
                    code: "QUOTA_EXCEEDED",
                    quota,
                },
                { status: 429 },
            );
        }

        if (sourceFilter === "scholar") {
            const scholarQuota = await consumeQuota({
                plan,
                feature: "scholar_search",
                identity,
                userID,
                unlimited: isAdmin,
            });
            if (!scholarQuota.allowed) {
                return NextResponse.json(
                    {
                        error: "Monthly Scholar search limit reached.",
                        code: "QUOTA_EXCEEDED",
                        quota: scholarQuota,
                    },
                    { status: 403 },
                );
            }
        }

        const normalizedQuery = searchValue.trim().toLowerCase();
        const usageContext: UsageContext = {
            feature:
                sourceFilter === "scholar" ? "scholar_search" : "search",
            userID,
            anonymousId: userID ? undefined : identity,
            metadata: { source: sourceFilter },
        };
        const cachedSearch = await cached({
            namespace: "paper-search-v1",
            key: `${normalizedQuery}:${page}:${sourceFilter}:${plan === "guest" ? "lexical" : "semantic"}`,
            ttlSeconds: sourceFilter === "scholar" ? 3_600 : 6 * 60 * 60,
            load: () =>
                runSearch(searchValue, page, sourceFilter, {
                    lightweight: plan === "guest",
                    usageContext,
                }),
        });
        const search = cachedSearch.value;
        if (!cachedSearch.cacheHit) {
            deferUsageRecording({
                context: usageContext,
                provider:
                    sourceFilter === "scholar"
                        ? "serpapi"
                        : "literature_apis",
                operation: "search",
                callCount: search.callCount || 1,
                metadata: { page },
            });
        }

        return NextResponse.json(
            {
                results: search.results,
                totalCount: search.totalCount,
                totalPages: search.totalPages,
                page,
                source: sourceFilter,
                query: searchValue,
                warnings: search.warnings,
                plan,
                quota,
                cacheHit: cachedSearch.cacheHit,
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch {
        console.error("Search request failed");
        return NextResponse.json(
            { error: "Search is temporarily unavailable." },
            { status: 500 },
        );
    }
});
