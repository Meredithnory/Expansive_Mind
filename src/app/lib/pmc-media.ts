export const PMC_OPEN_DATA_HOST = "pmc-oa-opendata.s3.amazonaws.com";
const PMC_OPEN_DATA_HTTPS = `https://${PMC_OPEN_DATA_HOST}`;
const WEB_IMAGE_NAME = /\.(?:jpe?g|png|webp|gif)$/i;

export function s3MediaToHttps(value: string) {
    const match = value.trim().match(/^s3:\/\/pmc-oa-opendata\/([^?]+)/i);
    if (!match?.[1]) return "";
    return `${PMC_OPEN_DATA_HTTPS}/${match[1]}`;
}

export function buildPmcMediaLookup(mediaUrls: unknown): Record<string, string> {
    const lookup: Record<string, string> = {};
    if (!Array.isArray(mediaUrls)) return lookup;

    for (const entry of mediaUrls) {
        if (typeof entry !== "string") continue;
        const httpsUrl = s3MediaToHttps(entry);
        if (!httpsUrl) continue;
        const filename = decodeURIComponent(
            httpsUrl.split("/").pop() || "",
        ).trim();
        if (!filename || !WEB_IMAGE_NAME.test(filename)) continue;
        lookup[filename] = httpsUrl;
        lookup[filename.toLowerCase()] = httpsUrl;
        const stem = filename.replace(/\.[^.]+$/, "");
        if (stem && !lookup[stem]) lookup[stem] = httpsUrl;
        if (stem && !lookup[stem.toLowerCase()]) {
            lookup[stem.toLowerCase()] = httpsUrl;
        }
    }
    return lookup;
}

export function resolvePmcMediaUrl(
    sourceRef: string,
    mediaUrls: Record<string, string>,
) {
    const filename = decodeURIComponent(
        sourceRef.replace(/\\/g, "/").split("/").pop() || "",
    ).trim();
    if (!filename) return "";
    return (
        mediaUrls[filename] ||
        mediaUrls[filename.toLowerCase()] ||
        mediaUrls[filename.replace(/\.[^.]+$/, "")] ||
        mediaUrls[filename.replace(/\.[^.]+$/, "").toLowerCase()] ||
        ""
    );
}
