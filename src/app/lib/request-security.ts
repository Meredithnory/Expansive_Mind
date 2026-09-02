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
