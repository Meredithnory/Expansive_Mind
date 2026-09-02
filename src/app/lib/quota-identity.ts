import { createHmac } from "crypto";

export function hashQuotaIdentity(identity: string) {
    const secret = process.env.RATE_LIMIT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("RATE_LIMIT_SECRET or JWT_SECRET is required.");
    }
    return createHmac("sha256", secret).update(identity).digest("hex");
}
