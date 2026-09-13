import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../authMiddleware";
import { hasValidMutationOrigin } from "../../lib/request-security";
import { consumeRateLimit } from "../../lib/rate-limit";
import { parseHighlightLookup } from "../../lib/paper-highlights";
import { loadCachedPaperBySource } from "../paper/load-paper";
import { generateShareSlug } from "../../lib/share-slug";
import PaperHighlight from "../../models/PaperHighlight";
import PaperShare from "../../models/PaperShare";

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json(
            { error: "Invalid origin." },
            { status: 403 },
        );
    }

    const rateLimit = await consumeRateLimit({
        scope: "paper-share-write",
        identity: request.user._id.toString(),
        limit: 20,
        windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many share requests. Please try again shortly." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rateLimit.retryAfterSeconds),
                },
            },
        );
    }

    const data = await request.json();
    const lookup = parseHighlightLookup(data);
    if (!lookup) {
        return NextResponse.json(
            { error: "A valid paper reference is required." },
            { status: 400 },
        );
    }

    const paperResult = await loadCachedPaperBySource(
        lookup.database,
        lookup.paperId,
        lookup.idName,
    );
    const paper = paperResult.value;
    if (!paper) {
        return NextResponse.json(
            { error: "Paper not found." },
            { status: 404 },
        );
    }
    if (!paper.access.canPersistContent) {
        return NextResponse.json(
            { error: paper.access.policyReason },
            { status: 403 },
        );
    }

    const highlightDocs = await PaperHighlight.find({
        userID: request.user._id,
        primarySource: lookup.primarySource,
        paperId: lookup.paperId,
        idName: lookup.idName,
    })
        .sort({ createdAt: 1 })
        .limit(50)
        .lean();

    const highlights = highlightDocs.map((highlight) => ({
        excerpt: highlight.excerpt,
        citation: {
            sectionTitle: highlight.citation.sectionTitle,
            startLine: highlight.citation.startLine,
            endLine: highlight.citation.endLine,
            lines: [...highlight.citation.lines],
        },
        createdAt: highlight.createdAt,
    }));
    const ownerName =
        [request.user.firstName, request.user.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "An Expansive Mind researcher";

    const share = await PaperShare.findOneAndUpdate(
        {
            ownerID: request.user._id,
            database: lookup.database,
            paperId: lookup.paperId,
            idName: lookup.idName,
        },
        {
            $set: {
                ownerName,
                title: paper.title,
                authors: paper.authors.slice(0, 20),
                sourceLabel: paper.primarySource || lookup.primarySource,
                canonicalUrl: paper.access.canonicalUrl || "",
                publicationDate: paper.publicationDate || "",
                highlights,
            },
            $setOnInsert: {
                ownerID: request.user._id,
                slug: generateShareSlug(),
                database: lookup.database,
                paperId: lookup.paperId,
                idName: lookup.idName,
            },
        },
        { new: true, upsert: true },
    );

    return NextResponse.json(
        {
            slug: share.slug,
            highlightCount: share.highlights.length,
            updatedAt: share.updatedAt,
        },
        {
            status: 200,
            headers: { "Cache-Control": "private, no-store" },
        },
    );
});
