/**
 * Allow only same-origin relative paths for post-auth redirects.
 * Rejects absolute URLs, protocol-relative URLs, backslashes, and control chars.
 */
export function safeInternalPath(
    candidate: string | null | undefined,
    fallback = "/discover",
): string {
    if (typeof candidate !== "string") return fallback;

    const path = candidate.trim();
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
        return fallback;
    }
    if (/[\u0000-\u001f\u007f]/.test(path)) return fallback;

    let decoded: string;
    try {
        decoded = decodeURIComponent(path);
    } catch {
        return fallback;
    }

    if (
        decoded.startsWith("//") ||
        decoded.includes("\\") ||
        /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)
    ) {
        return fallback;
    }

    try {
        const base = "https://internal.invalid";
        const url = new URL(path, base);
        if (url.origin !== base) return fallback;
        const normalized = `${url.pathname}${url.search}${url.hash}`;
        return normalized.startsWith("/") ? normalized : fallback;
    } catch {
        return fallback;
    }
}
