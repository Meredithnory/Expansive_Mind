import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../authMiddleware";
import PaperHighlight from "../../models/PaperHighlight";
import { hasValidMutationOrigin } from "../../lib/request-security";
import { consumeRateLimit } from "../../lib/rate-limit";
import { loadCachedPaperBySource } from "../paper/load-paper";
import {
    MAX_HIGHLIGHTS_PER_PAPER,
    parseHighlightCitation,
    parseHighlightExcerpt,
    parseHighlightLookup,
    serializePaperHighlight,
} from "../../lib/paper-highlights";

async function loadPersistedPaper(
    lookup: ReturnType<typeof parseHighlightLookup>,
) {
    if (!lookup) return null;
    const paperResult = await loadCachedPaperBySource(
        lookup.database,
        lookup.paperId,
        lookup.idName,
    );
    return paperResult.value;
}

function highlightQuery(
    userID: mongoose.Types.ObjectId,
    lookup: NonNullable<ReturnType<typeof parseHighlightLookup>>,
) {
    return {
        userID,
        primarySource: lookup.primarySource,
        paperId: lookup.paperId,
        idName: lookup.idName,
    };
}

export const GET = withAuth(async (request: NextRequest) => {
    const lookup = parseHighlightLookup({
        database: request.nextUrl.searchParams.get("database"),
        paperId: request.nextUrl.searchParams.get("paperId"),
        idName: request.nextUrl.searchParams.get("idName"),
    });
    if (!lookup) {
        return NextResponse.json(
            { error: "A valid paper reference is required." },
            { status: 400 },
        );
    }

    const rateLimit = await consumeRateLimit({
        scope: "highlights-read",
        identity: request.user._id.toString(),
        limit: 60,
        windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many highlight requests. Please try again shortly." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rateLimit.retryAfterSeconds),
                },
            },
        );
    }

    const docs = await PaperHighlight.find(highlightQuery(request.user._id, lookup))
        .sort({ createdAt: 1 })
        .limit(MAX_HIGHLIGHTS_PER_PAPER)
        .lean();

    return NextResponse.json(
        {
            highlights: docs.map((doc) =>
                serializePaperHighlight(
                    doc as unknown as Parameters<
                        typeof serializePaperHighlight
                    >[0],
                ),
            ),
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});

export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json(
            { error: "Invalid origin." },
            { status: 403 },
        );
    }

    const rateLimit = await consumeRateLimit({
        scope: "highlights-write",
        identity: request.user._id.toString(),
        limit: 30,
        windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Too many highlight saves. Please try again shortly." },
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
    const excerpt = parseHighlightExcerpt(data.excerpt);
    const citation = parseHighlightCitation(data.citation);
    if (!lookup || !excerpt || !citation) {
        return NextResponse.json(
            { error: "A valid paper excerpt is required." },
            { status: 400 },
        );
    }

    const paper = await loadPersistedPaper(lookup);
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

    const query = highlightQuery(request.user._id, lookup);
    const existingCount = await PaperHighlight.countDocuments(query);
    if (existingCount >= MAX_HIGHLIGHTS_PER_PAPER) {
        return NextResponse.json(
            {
                error: `You can save up to ${MAX_HIGHLIGHTS_PER_PAPER} highlights on this paper.`,
            },
            { status: 429 },
        );
    }

    const created = await PaperHighlight.create({
        ...query,
        excerpt,
        citation,
    });

    return NextResponse.json(
        { highlight: serializePaperHighlight(created) },
        {
            status: 201,
            headers: { "Cache-Control": "private, no-store" },
        },
    );
});

export const DELETE = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json(
            { error: "Invalid origin." },
            { status: 403 },
        );
    }

    const data = await request.json();
    const highlightId =
        typeof data.highlightId === "string" ? data.highlightId.trim() : "";
    if (!mongoose.Types.ObjectId.isValid(highlightId)) {
        return NextResponse.json(
            { error: "A valid highlight is required." },
            { status: 400 },
        );
    }

    await PaperHighlight.deleteOne({
        _id: highlightId,
        userID: request.user._id,
    });

    return NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
