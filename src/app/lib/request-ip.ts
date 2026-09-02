function firstHeaderValue(request: Request, name: string): string | null {
    const raw = request.headers.get(name);
    if (!raw) return null;
    const value = raw.split(",")[0]?.trim();
    return value || null;
}

function normalizeIp(value: string): string {
    return value.replace(/^::ffff:/i, "").toLowerCase();
}

function platformIp(request: Request): string | null {
    if (!("ip" in request)) return null;
    const value = (request as { ip?: unknown }).ip;
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function requestIp(request: Request): string {
    const trusted =
        firstHeaderValue(request, "x-vercel-forwarded-for") ||
        firstHeaderValue(request, "cf-connecting-ip") ||
        firstHeaderValue(request, "x-real-ip") ||
        platformIp(request);
    if (trusted) return normalizeIp(trusted);

    // Ignore spoofable X-Forwarded-For so guests cannot mint a new free
    // quota by sending a different header. Unknown networks share one bucket.
    return "unknown";
}
