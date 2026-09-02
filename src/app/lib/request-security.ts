import type { NextRequest } from "next/server";

export function hasValidMutationOrigin(request: NextRequest) {
    const origin = request.headers.get("origin");
    if (!origin) return true;
    return origin === request.nextUrl.origin;
}
