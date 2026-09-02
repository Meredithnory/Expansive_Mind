const SPRINGER_CDN_HOSTS = new Set([
    "media.springernature.com",
    "static-content.springer.com",
]);

const normalizeDoi = (doi: string) =>
    doi
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/doi\.org\//i, "");

const springerCdnUrl = (doi: string, rawPath: string) => {
    const path = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path.includes("..") || path.includes("://")) return "";
    const mediaPath = path.includes("/") ? path : `MediaObjects/${path}`;
    const articleKey = encodeURIComponent(`art:${doi}`);
    return `https://media.springernature.com/original/springer-static/image/${articleKey}/${mediaPath}`;
};

export function buildSpringerImageUrl(sourceRef: string, doi: string) {
    const ref = sourceRef.trim();
    const normalizedDoi = normalizeDoi(doi);
    if (!ref || !normalizedDoi) return "";

    const absolute = ref.startsWith("//") ? `https:${ref}` : ref;
    try {
        const url = new URL(absolute);
        if (url.protocol !== "https:") return "";
        if (SPRINGER_CDN_HOSTS.has(url.hostname)) return url.toString();
        if (url.hostname === "link.springer.com") {
            return springerCdnUrl(normalizedDoi, url.pathname);
        }
        return "";
    } catch {
        return springerCdnUrl(normalizedDoi, ref);
    }
}
