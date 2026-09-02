import "server-only";
import { createHmac } from "crypto";
import connectDB from "../db/connectDB";
import RateLimit from "../models/RateLimit";

export { requestIp } from "./request-ip";

const secret = process.env.RATE_LIMIT_SECRET || process.env.JWT_SECRET;

function hashKey(value: string) {
    if (!secret) {
        throw new Error("RATE_LIMIT_SECRET or JWT_SECRET is required.");
    }
    return createHmac("sha256", secret).update(value).digest("hex");
}

export async function consumeRateLimit(input: {
    scope: string;
    identity: string;
    limit: number;
    windowMs: number;
}) {
    await connectDB();
    const now = Date.now();
    const bucket = Math.floor(now / input.windowMs);
    const id = hashKey(`${input.scope}:${input.identity}:${bucket}`);
    const expiresAt = new Date((bucket + 2) * input.windowMs);
    const record = await RateLimit.findOneAndUpdate(
        { _id: id },
        {
            $inc: { count: 1 },
            $setOnInsert: { expiresAt },
        },
        { upsert: true, new: true },
    ).lean<{ count: number }>();

    return {
        allowed: Number(record?.count || 0) <= input.limit,
        remaining: Math.max(0, input.limit - Number(record?.count || 0)),
        retryAfterSeconds: Math.max(
            1,
            Math.ceil(((bucket + 1) * input.windowMs - now) / 1_000),
        ),
    };
}
