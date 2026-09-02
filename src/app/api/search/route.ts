import { NextRequest, NextResponse } from "next/server";
import {
    searchNIHPaperIds,
    getNIHPaperResults,
    searchSpringerNaturePapers,
    searchGoogleScholarPapers,
    mergeResultsByTier,
    isNihApiConfigured,
} from "./utils";
import { rankSearchResults } from "./semantic-rank";
import { withOptionalAuth } from "../authMiddleware";
import { evaluateContentAccess } from "../../lib/content-access-policy";
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

type SourceFilter = "all" | "nih" | "springer" | "scholar";

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
    const { includeNih, includeSpringer, includeScholar } =
        getSourceFlags(sourceFilter);
    const lightweight = options?.lightweight ?? false;

    const [nihSearch, springerSearch, scholarSearch] = await Promise.all([
        includeNih
            ? searchNIHPaperIds(searchValue, page)
            : Promise.resolve({
                  ids: [],
                  totalCount: 0,
                  totalPages: 0,
                  page,
              }),
        includeSpringer
            ? searchSpringerNaturePapers(searchValue, page)
            : Promise.resolve({
                  results: [],
                  totalCount: 0,
                  totalPages: 0,
              }),
        includeScholar
            ? searchGoogleScholarPapers(searchValue, page)
            : Promise.resolve({
                  results: [],
                  totalCount: 0,
                  totalPages: 0,
              }),
    ]);

    const { ids, totalCount: nihTotalCount, totalPages: nihTotalPages } =
        nihSearch;

    const nihPaperResults =
        lightweight || ids.length === 0
            ? []
            : await getNIHPaperResults(ids, searchValue);

    const formattedNIHResults = nihPaperResults.map((paper: any) => {
        const sourceUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${paper.pmcid}/`;
        return {
            sourceId: paper.pmcid,
            title: paper.title,
            authors: paper.authors,
            date: paper.date,
            abstract: paper.abstract,
            matchTier: paper.matchTier,
            source: "nih",
            sourceLabel: "NIH PubMed Central",
            sourceUrl,
            contentLabel: "Abstract",
            access: evaluateContentAccess({
                source: "nih",
                rawLicense: null,
                attribution: {
                    title: paper.title || "Untitled",
                    authors: paper.authors || [],
                    sourceLabel: "NIH PubMed Central",
                    canonicalUrl: sourceUrl,
                    paperId: paper.pmcid,
                    idName: "pmcid",
                    publicationDate: paper.date || undefined,
                },
            }),
        };
    });

    const sourceResults: any[][] = [];
    let totalCount = 0;
    let totalPages = 0;

    if (includeNih) {
        sourceResults.push(formattedNIHResults);
        totalCount += nihTotalCount;
        totalPages = Math.max(totalPages, nihTotalPages);
    }

    if (includeSpringer) {
        sourceResults.push(springerSearch.results);
        totalCount += springerSearch.totalCount;
        totalPages = Math.max(totalPages, springerSearch.totalPages);
    }

    if (includeScholar) {
        sourceResults.push(scholarSearch.results);
        totalCount += scholarSearch.totalCount;
        totalPages = Math.max(totalPages, scholarSearch.totalPages);
    }

    const mergedResults =
        sourceResults.length > 1
            ? mergeResultsByTier(...sourceResults)
            : sourceResults[0] || [];
    const paperResults = lightweight
        ? mergedResults
        : await rankSearchResults(
              searchValue,
              mergedResults,
              options?.usageContext,
          );

    return {
        results: paperResults,
        totalCount,
        totalPages,
        warnings:
            includeNih && !isNihApiConfigured()
                ? [
                      "NIH PubMed Central search is unavailable until NCBI_EMAIL is configured.",
                  ]
                : [],
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
            !["all", "nih", "springer", "scholar"].includes(sourceFilter) ||
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
                callCount:
                    sourceFilter === "all"
                        ? 3
                        : sourceFilter === "nih"
                          ? 2
                          : 1,
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
