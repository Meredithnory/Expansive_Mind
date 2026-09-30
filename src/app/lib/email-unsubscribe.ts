import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// A signed, unguessable token per account: the unsubscribe link needs no
// sign-in, and only turns product email off. Its own secret, not JWT_SECRET:
// rotating sign-in keys must not break links already sent (CAN-SPAM needs
// them working 30 days after a send).

/** Group email needs this set; without it there is no working unsubscribe link. */
export function hasUnsubscribeSecret() {
    return Boolean(process.env.EMAIL_UNSUBSCRIBE_SECRET);
}

function secret() {
    const value = process.env.EMAIL_UNSUBSCRIBE_SECRET;
    if (!value) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is required for unsubscribe links.");
    return value;
}

function signature(userId: string) {
    return createHmac("sha256", secret())
        .update(`product-email-unsubscribe:${userId}`)
        .digest("base64url");
}

export function unsubscribeToken(userId: string) {
    return `${userId}.${signature(userId)}`;
}

/** The account id a token was made for, or null when it doesn't verify. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
    const match = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/.exec(token ?? "");
    if (!match) return null;
    const expected = Buffer.from(signature(match[1]));
    const given = Buffer.from(match[2]);
    return expected.length === given.length && timingSafeEqual(expected, given)
        ? match[1]
        : null;
}

export function unsubscribeUrl(origin: string, userId: string) {
    const url = new URL("/unsubscribe", origin);
    url.searchParams.set("token", unsubscribeToken(userId));
    return url.toString();
}
