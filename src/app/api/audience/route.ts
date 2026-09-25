import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import connectDB from "../../db/connectDB";
import PageEngagement from "../../models/PageEngagement";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import { hashQuotaIdentity } from "../../lib/quota-identity";
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

const COOKIE = "em_audience";

function visitorToken(request: NextRequest) {
    const existing = request.cookies.get(COOKIE)?.value;
    if (existing && /^[a-f0-9]{32}$/.test(existing)) {
        return { token: existing, fresh: false };
    }
    return { token: randomBytes(16).toString("hex"), fresh: true };
}

function withVisitorCookie(response: NextResponse, token: string, fresh: boolean) {
    if (!fresh) return response;
    response.cookies.set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 120,
    });
    return response;
}

export const POST = withOptionalAuth(async (req: NextRequest) => {
    const visitor = visitorToken(req);
    if (!hasValidMutationOrigin(req)) {
        return withVisitorCookie(
            NextResponse.json({ error: "Invalid origin." }, { status: 403 }),
            visitor.token,
            visitor.fresh,
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
            return withVisitorCookie(
                NextResponse.json({ ok: false }, { status: 429 }),
                visitor.token,
                visitor.fresh,
            );
        }

        const parsedBody = await readLimitedJsonBody(req, 2_048);
        if (!parsedBody.ok) {
            return withVisitorCookie(
                NextResponse.json(
                    {
                        error:
                            parsedBody.status === 413
                                ? "Audience payload is too large."
                                : "A valid audience update is required.",
                    },
                    { status: parsedBody.status },
                ),
                visitor.token,
                visitor.fresh,
            );
        }
        const data = parsedBody.value as Record<string, unknown>;
        const page = typeof data.page === "string" ? data.page : "";
        const next = typeof data.next === "string" ? data.next : "";
        if (!(page in AUDIENCE_PAGES)) {
            return withVisitorCookie(
                NextResponse.json({ error: "Unknown page." }, { status: 400 }),
                visitor.token,
                visitor.fresh,
            );
        }
        const seconds = clampAudienceSeconds(data.seconds);
        const destination =
            next in AUDIENCE_PAGES && next !== page
                ? (next as AudiencePage)
                : null;
        if (!seconds && !destination) {
            return withVisitorCookie(
                NextResponse.json({ ok: true }),
                visitor.token,
                visitor.fresh,
            );
        }

        const day = new Date().toISOString().slice(0, 10);
        const visitorKey = hashQuotaIdentity(`audience:${visitor.token}`);
        const expiresAt = new Date();
        expiresAt.setUTCDate(expiresAt.getUTCDate() + 120);
        const increment: Record<string, number> = {};
        if (seconds) increment[`secondsByPage.${page}`] = seconds;
        if (destination) increment[`moves.${moveKey(page as AudiencePage, destination)}`] = 1;

        await connectDB();
        await PageEngagement.updateOne(
            { _id: hashQuotaIdentity(`${visitorKey}:${day}`) },
            {
                $setOnInsert: {
                    visitorKey,
                    day,
                    expiresAt,
                },
                ...(req.user?._id ? { $set: { userID: req.user._id } } : {}),
                $inc: increment,
            },
            { upsert: true },
        );
        if (req.user?._id) {
            await PageEngagement.updateMany(
                { visitorKey, userID: { $exists: false } },
                { $set: { userID: req.user._id } },
            );
        }

        return withVisitorCookie(
            NextResponse.json({ ok: true }),
            visitor.token,
            visitor.fresh,
        );
    } catch {
        console.error("Audience update failed");
        return withVisitorCookie(
            NextResponse.json({ error: "Audience update failed." }, { status: 500 }),
            visitor.token,
            visitor.fresh,
        );
    }
});
