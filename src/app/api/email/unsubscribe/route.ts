import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../db/connectDB";
import { verifyUnsubscribeToken } from "../../../lib/email-unsubscribe";
import { consumeRateLimit, requestIp } from "../../../lib/rate-limit";
import User from "../../../models/User";

async function tokenFrom(request: NextRequest) {
    const fromQuery = request.nextUrl.searchParams.get("token");
    if (fromQuery) return fromQuery;
    const body = await request.json().catch(() => null);
    return body && typeof body.token === "string" ? body.token : null;
}

/**
 * Turns product email off. The signed token is the authority, so mail
 * apps' one-click unsubscribe (a POST with no Origin) works too.
 *
 * Only bad tokens are rate-limited. Gmail and Yahoo send one-click
 * unsubscribes from a few shared servers, so a per-IP cap on valid tokens
 * would drop real opt-outs after a group send.
 */
export async function POST(request: NextRequest) {
    const userId = verifyUnsubscribeToken(await tokenFrom(request));
    if (!userId) {
        const limit = await consumeRateLimit({
            scope: "email-unsubscribe-invalid",
            identity: requestIp(request),
            limit: 20,
            windowMs: 60 * 60_000,
        });
        if (!limit.allowed) return NextResponse.json({ error: "Try again in a bit." }, { status: 429 });
        return NextResponse.json({ error: "That unsubscribe link isn't valid." }, { status: 400 });
    }
    await connectDB();
    await User.updateOne(
        { _id: userId },
        { $set: { productEmailOptIn: false, productEmailOptOutAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
}
