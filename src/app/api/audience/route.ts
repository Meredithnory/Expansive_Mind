import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import connectDB from "../../db/connectDB";
import PageEngagement from "../../models/PageEngagement";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import { hashQuotaIdentity } from "../../lib/quota-identity";
import {
    audienceVisitor,
    audienceVisitorKey,
    withAudienceCookie,
} from "../../lib/audience-visitor";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../lib/request-security";
import {
    AUDIENCE_PAGES,
    type AudiencePage,
    clampAudienceSeconds,
    moveKey,
} from "../../lib/audience";

export const POST = withOptionalAuth(async (req: NextRequest) => {
    const visitor = audienceVisitor(req);
    if (!hasValidMutationOrigin(req)) {
        return withAudienceCookie(
            NextResponse.json({ error: "Invalid origin." }, { status: 403 }),
            visitor,
        );
    }

    try {
        const identity = req.user?._id?.toString() || visitor.token || requestIp(req);
        const rateLimit = await consumeRateLimit({
            scope: "audience",
            identity,
            limit: 20,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return withAudienceCookie(
                NextResponse.json({ ok: false }, { status: 429 }),
                visitor,
            );
        }

        const parsedBody = await readLimitedJsonBody(req, 2_048);
        if (!parsedBody.ok) {
            return withAudienceCookie(
                NextResponse.json(
                    {
                        error:
                            parsedBody.status === 413
                                ? "Audience payload is too large."
                                : "A valid audience update is required.",
                    },
                    { status: parsedBody.status },
                ),
                visitor,
            );
        }
        const data = parsedBody.value as Record<string, unknown>;
        const page = typeof data.page === "string" ? data.page : "";
        const next = typeof data.next === "string" ? data.next : "";
        if (!(page in AUDIENCE_PAGES)) {
            return withAudienceCookie(
                NextResponse.json({ error: "Unknown page." }, { status: 400 }),
                visitor,
            );
        }
        const seconds = clampAudienceSeconds(data.seconds);
        const destination =
            next in AUDIENCE_PAGES && next !== page
                ? (next as AudiencePage)
                : null;
        const away = data.away === true;
        if (!seconds && !destination && !away) {
            return withAudienceCookie(
                NextResponse.json({ ok: true }),
                visitor,
            );
        }

        const now = new Date();
        const day = now.toISOString().slice(0, 10);
        const visitorKey = audienceVisitorKey(visitor.token);
        const expiresAt = new Date();
        expiresAt.setUTCDate(expiresAt.getUTCDate() + 120);
        const increment: Record<string, number> = {};
        if (seconds) increment[`secondsByPage.${page}`] = seconds;
        if (destination) increment[`moves.${moveKey(page as AudiencePage, destination)}`] = 1;
        const presence = {
            lastSeenAt: now,
            lastPage: destination ?? page,
            away,
            ...(req.user?._id ? { userID: req.user._id } : {}),
        };

        await connectDB();
        const _id = hashQuotaIdentity(`${visitorKey}:${day}`);
        if (Object.keys(increment).length) {
            await PageEngagement.updateOne(
                { _id },
                {
                    $setOnInsert: {
                        visitorKey,
                        day,
                        expiresAt,
                    },
                    $set: presence,
                    $inc: increment,
                },
                { upsert: true },
            );
        } else {
            // "Away" with no time to add: mark it without counting a visit.
            await PageEngagement.updateOne({ _id }, { $set: presence });
        }
        if (req.user?._id) {
            await PageEngagement.updateMany(
                { visitorKey, userID: { $exists: false } },
                { $set: { userID: req.user._id } },
            );
        }

        return withAudienceCookie(
            NextResponse.json({ ok: true }),
            visitor,
        );
    } catch {
        console.error("Audience update failed");
        return withAudienceCookie(
            NextResponse.json({ error: "Audience update failed." }, { status: 500 }),
            visitor,
        );
    }
});
