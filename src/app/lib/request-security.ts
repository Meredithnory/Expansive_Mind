import type { NextRequest } from "next/server";

export function hasValidMutationOrigin(request: NextRequest) {
    const origin = request.headers.get("origin");
    if (origin) return origin === request.nextUrl.origin;

    // Browsers that omit Origin still send Fetch Metadata. Reject requests
    // with neither signal instead of treating an unverifiable request as
    // same-origin. Stripe webhooks do not use this browser-only helper.
    const fetchSite = request.headers.get("sec-fetch-site");
    return fetchSite === "same-origin" || fetchSite === "none";
}

export function hasAcceptableContentLength(
    request: NextRequest,
    maxBytes: number,
) {
    const raw = request.headers.get("content-length");
    if (!raw) return true;
    const length = Number(raw);
    return Number.isInteger(length) && length >= 0 && length <= maxBytes;
}

export async function readLimitedJsonBody(
    request: NextRequest,
    maxBytes: number,
): Promise<
    | { ok: true; value: unknown }
    | { ok: false; status: 400 | 413 }
> {
    if (!hasAcceptableContentLength(request, maxBytes)) {
        return { ok: false, status: 413 };
    }
    if (!request.body) return { ok: false, status: 400 };

    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytesRead = 0;
    let text = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytesRead += value.byteLength;
            if (bytesRead > maxBytes) {
                await reader.cancel();
                return { ok: false, status: 413 };
            }
            text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
    } finally {
        reader.releaseLock();
    }

    try {
        return { ok: true, value: JSON.parse(text) };
    } catch {
        return { ok: false, status: 400 };
    }
}

export function trustedApplicationOrigin(request: NextRequest) {
    const configured = process.env.APP_URL;
    if (!configured && process.env.NODE_ENV === "production") {
        throw new Error("APP_URL is required in production.");
    }
    const url = new URL(configured || request.nextUrl.origin);
    if (
        url.username ||
        url.password ||
        !["http:", "https:"].includes(url.protocol) ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    ) {
        throw new Error("APP_URL is invalid.");
    }
    return url.origin;
}
