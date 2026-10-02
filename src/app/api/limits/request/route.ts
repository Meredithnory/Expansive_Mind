import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import connectDB from "../../../db/connectDB";
import LimitAlert from "../../../models/LimitAlert";
import { DEVELOPER_EMAIL } from "../../../lib/contact";
import { limitRequestEmail } from "../../../lib/limit-alert-mail";
import { normalizeLimitRequest } from "../../../lib/limit-reached";
import { getPlanEntitlements, resolvePlan } from "../../../lib/plan-config";
import { monthKey } from "../../../lib/quota-period";
import { consumeRateLimit } from "../../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
    trustedApplicationOrigin,
} from "../../../lib/request-security";
import { sendEmail } from "../../../lib/send-email";

const KEEP_DAYS = 400;

/**
 * "Ask for more" from the limit pop-up. Marks this month's limit row for
 * the person and allowance, and emails Meredith the first time.
 */
export const POST = withAuth(async (request: NextRequest) => {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const userId = request.user._id.toString();
    const limit = await consumeRateLimit({
        scope: "limit-request",
        identity: userId,
        limit: 6,
        windowMs: 24 * 60 * 60_000,
    });
    if (!limit.allowed) {
        return NextResponse.json({ error: "Too many requests today. Try again tomorrow." }, { status: 429 });
    }
    const parsed = await readLimitedJsonBody(request, 4_096);
    const ask = parsed.ok ? normalizeLimitRequest(parsed.value) : null;
    if (!ask) {
        return NextResponse.json({ error: "Say which allowance you need more of." }, { status: 400 });
    }

    try {
        await connectDB();
        const now = new Date();
        const period = monthKey(now);
        const _id = `${userId}:${ask.feature}:${period}`;
        const planLimit = (await getPlanEntitlements(resolvePlan(request.user)))[ask.feature];
        // Upsert: the row exists when the limit alert ran; create it if not.
        const before = await LimitAlert.findOneAndUpdate(
            { _id },
            {
                $setOnInsert: {
                    userID: request.user._id,
                    feature: ask.feature,
                    period,
                    limit: planLimit,
                    used: planLimit,
                    firstAt: now,
                    expiresAt: new Date(now.getTime() + KEEP_DAYS * 24 * 60 * 60 * 1_000),
                },
                $set: {
                    lastAt: now,
                    requestedAt: now,
                    ...(ask.note ? { requestNote: ask.note } : {}),
                },
            },
            { upsert: true, new: false },
        ).lean<{ requestedAt?: Date; used?: number; limit?: number } | null>();

        if (before?.requestedAt) {
            return NextResponse.json({ ok: true, already: true });
        }

        const mail = limitRequestEmail({
            origin: trustedApplicationOrigin(request),
            name: [request.user.firstName, request.user.lastName].filter(Boolean).join(" "),
            email: request.user.email,
            feature: ask.feature,
            used: before?.used ?? planLimit,
            limit: before?.limit ?? planLimit,
            period,
            note: ask.note,
        });
        const sent = await sendEmail({ to: DEVELOPER_EMAIL, replyTo: request.user.email, ...mail });
        return NextResponse.json({ ok: true, emailed: sent.accepted });
    } catch {
        console.error("Limit request failed");
        return NextResponse.json({ error: "That didn't send." }, { status: 500 });
    }
});
