import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "../authMiddleware";
import connectDB from "../../db/connectDB";
import ActivityEvent from "../../models/ActivityEvent";
import { ACTIVITY_DAYS, normalizeActivity } from "../../lib/activity";
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

/** Records one step (a page view, a discovery, a search) for /admin/live. */
export const POST = withOptionalAuth(async (request: NextRequest) => {
    const visitor = audienceVisitor(request);
    const reply = (body: unknown, status = 200) =>
        withAudienceCookie(NextResponse.json(body, { status }), visitor);
    if (!hasValidMutationOrigin(request)) {
        return reply({ error: "Invalid origin." }, 403);
    }

    try {
        const limit = await consumeRateLimit({
            scope: "activity",
            identity: request.user?._id?.toString() || visitor.token,
            limit: 60,
            windowMs: 60_000,
        });
        if (!limit.allowed) return reply({ ok: false }, 429);

        const parsed = await readLimitedJsonBody(request, 2_048);
        const activity = parsed.ok ? normalizeActivity(parsed.value) : null;
        if (!activity) return reply({ error: "Unknown activity." }, 400);

        await connectDB();
        await ActivityEvent.create({
            kind: activity.kind,
            page: activity.page,
            ...(activity.path ? { path: activity.path } : {}),
            ...(activity.detail ? { detail: activity.detail } : {}),
            visitorKey: audienceVisitorKey(visitor.token),
            userID: request.user?._id,
            at: new Date(),
            expiresAt: new Date(Date.now() + ACTIVITY_DAYS * 24 * 60 * 60 * 1_000),
        });
        return reply({ ok: true });
    } catch {
        console.error("Activity update failed");
        return reply({ ok: false }, 500);
    }
});
