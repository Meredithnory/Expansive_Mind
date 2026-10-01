import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import connectDB from "../../db/connectDB";
import Rating from "../../models/Rating";
import {
    RATING_COMMENT_WINDOW_MS,
    normalizeRating,
    normalizeRatingComment,
} from "../../lib/rating";
import {
    audienceVisitor,
    audienceVisitorKey,
    withAudienceCookie,
} from "../../lib/audience-visitor";
import { consumeRateLimit } from "../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../lib/request-security";

/**
 * Saves an answer to "How is Expansive Mind doing?". A second call with the
 * rating's id adds the optional comment; only the browser that rated can.
 */
export const POST = withOptionalAuth(async (request: NextRequest) => {
    const visitor = audienceVisitor(request);
    const reply = (body: unknown, status = 200) =>
        withAudienceCookie(NextResponse.json(body, { status }), visitor);
    if (!hasValidMutationOrigin(request)) {
        return reply({ error: "Invalid origin." }, 403);
    }

    try {
        const limit = await consumeRateLimit({
            scope: "rating",
            identity: request.user?._id?.toString() || visitor.token,
            limit: 12,
            windowMs: 60 * 60_000,
        });
        if (!limit.allowed) {
            return reply({ error: "Too many ratings. Try again later." }, 429);
        }

        const parsed = await readLimitedJsonBody(request, 4_096);
        if (!parsed.ok) return reply({ error: "A rating is required." }, parsed.status);
        const visitorKey = audienceVisitorKey(visitor.token);

        const followUp = normalizeRatingComment(parsed.value);
        if (followUp) {
            await connectDB();
            const updated = await Rating.updateOne(
                {
                    _id: followUp.id,
                    visitorKey,
                    comment: { $exists: false },
                    createdAt: { $gte: new Date(Date.now() - RATING_COMMENT_WINDOW_MS) },
                },
                { $set: { comment: followUp.comment } },
            );
            if (!updated.matchedCount) {
                return reply({ error: "That rating can't take a comment now." }, 404);
            }
            return reply({ ok: true, id: followUp.id });
        }

        const rating = normalizeRating(parsed.value);
        if (!rating) return reply({ error: "A rating is required." }, 400);
        await connectDB();
        const created = await Rating.create({
            ...rating,
            visitorKey,
            userID: request.user?._id,
        });
        return reply({ ok: true, id: String(created._id) });
    } catch {
        console.error("Rating failed");
        return reply({ error: "That didn't save." }, 500);
    }
});
