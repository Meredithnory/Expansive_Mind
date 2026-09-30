import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../db/connectDB";
import ProductSignal from "../../models/ProductSignal";
import { isProductSignal } from "../../lib/product-signals";
import { consumeRateLimit, requestIp } from "../../lib/rate-limit";
import {
    hasValidMutationOrigin,
    readLimitedJsonBody,
} from "../../lib/request-security";

/** Counts one product moment for today. Keys only; nothing about the person. */
export async function POST(request: NextRequest) {
    if (!hasValidMutationOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const limit = await consumeRateLimit({
        scope: "product-signal",
        identity: requestIp(request),
        limit: 60,
        windowMs: 60 * 60_000,
    });
    if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

    const parsed = await readLimitedJsonBody(request, 512);
    const signal = parsed.ok ? (parsed.value as Record<string, unknown>).signal : null;
    if (!isProductSignal(signal)) {
        return NextResponse.json({ error: "Unknown signal." }, { status: 400 });
    }
    const day = new Date().toISOString().slice(0, 10);
    const expiresAt = new Date(Date.now() + 400 * 24 * 60 * 60 * 1_000);
    try {
        await connectDB();
        await ProductSignal.updateOne(
            { _id: `${day}:${signal}` },
            { $setOnInsert: { day, key: signal, expiresAt }, $inc: { count: 1 } },
            { upsert: true },
        );
    } catch {
        console.error("Product signal failed");
        return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
