import "server-only";

const ALLOWED_IMAGE_HOSTS = new Set([
    "pmc.ncbi.nlm.nih.gov",
    "cdn.ncbi.nlm.nih.gov",
    "pmc-oa-opendata.s3.amazonaws.com",
    "media.springernature.com",
    "static-content.springer.com",
    "link.springer.com",
]);
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
export const MAX_FIGURE_BYTES = 5 * 1024 * 1024;
export const MAX_FIGURE_PIXELS = 25_000_000;
const MAX_REDIRECTS = 3;
const IMAGE_TIMEOUT_MS = 12_000;

export interface ValidatedFigureImage {
    bytes: Uint8Array;
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    width?: number;
    height?: number;
}

export function validateFigureSourceUrl(value: string) {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error("The figure image URL is invalid.");
    }
    if (
        url.protocol !== "https:" ||
        !ALLOWED_IMAGE_HOSTS.has(url.hostname) ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")
    ) {
        throw new Error("The figure image host is not allowed.");
    }
    return url;
}

const hasSignature = (bytes: Uint8Array, signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);

function detectMimeType(bytes: Uint8Array) {
    if (hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return "image/png" as const;
    }
    if (hasSignature(bytes, [0xff, 0xd8, 0xff])) {
        return "image/jpeg" as const;
    }
    if (
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    ) {
        return "image/webp" as const;
    }
    const gifHeader = String.fromCharCode(...bytes.slice(0, 6));
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
        return "image/gif" as const;
    }
    throw new Error("The uploaded file is not a supported image.");
}

function readPngDimensions(bytes: Uint8Array) {
    if (bytes.length < 24) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = bytes[offset + 1];
        if (marker === 0xd8 || marker === 0xd9) {
            offset += 2;
            continue;
        }
        const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
        if (length < 2 || offset + length + 2 > bytes.length) return null;
        if (
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf)
        ) {
            return {
                height: (bytes[offset + 5] << 8) + bytes[offset + 6],
                width: (bytes[offset + 7] << 8) + bytes[offset + 8],
            };
        }
        offset += length + 2;
    }
    return null;
}

function readGifDimensions(bytes: Uint8Array) {
    if (bytes.length < 10) return null;
    return {
        width: bytes[6] + (bytes[7] << 8),
        height: bytes[8] + (bytes[9] << 8),
    };
}

function readWebpDimensions(bytes: Uint8Array) {
    if (bytes.length < 25) return null;
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") {
        if (bytes.length < 30) return null;
        return {
            width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
            height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
        };
    }
    if (
        chunk === "VP8 " &&
        bytes.length >= 30 &&
        hasSignature(bytes.slice(23), [0x9d, 0x01, 0x2a])
    ) {
        return {
            width: (bytes[26] + (bytes[27] << 8)) & 0x3fff,
            height: (bytes[28] + (bytes[29] << 8)) & 0x3fff,
        };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
        return {
            width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
            height:
                1 +
                (bytes[22] >> 6) +
                (bytes[23] << 2) +
                ((bytes[24] & 0x0f) << 10),
        };
    }
    return null;
}

export function validateFigureBytes(
    input: ArrayBuffer | Uint8Array,
    declaredType?: string,
): ValidatedFigureImage {
    const bytes =
        input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!bytes.length || bytes.length > MAX_FIGURE_BYTES) {
        throw new Error("Figure images must be no larger than 5 MB.");
    }
    const mimeType = detectMimeType(bytes);
    const declaredImageType =
        declaredType && ALLOWED_IMAGE_TYPES.has(declaredType)
            ? declaredType
            : undefined;
    if (declaredImageType && declaredImageType !== mimeType) {
        throw new Error("The figure image type does not match its contents.");
    }
    const dimensions =
        mimeType === "image/png"
            ? readPngDimensions(bytes)
            : mimeType === "image/jpeg"
              ? readJpegDimensions(bytes)
              : mimeType === "image/gif"
                ? readGifDimensions(bytes)
                : readWebpDimensions(bytes);
    if (
        dimensions &&
        (dimensions.width <= 0 ||
            dimensions.height <= 0 ||
            dimensions.width * dimensions.height > MAX_FIGURE_PIXELS)
    ) {
        throw new Error("The figure image dimensions are too large.");
    }
    return { bytes, mimeType, ...dimensions };
}

async function readImageBody(response: Response): Promise<Uint8Array> {
    if (!response.body) {
        return new Uint8Array(await response.arrayBuffer());
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAX_FIGURE_BYTES) {
                await reader.cancel();
                throw new Error("Figure images must be no larger than 5 MB.");
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

export async function fetchFigureImage(
    sourceUrl: string,
): Promise<ValidatedFigureImage> {
    let url = validateFigureSourceUrl(sourceUrl);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                redirect: "manual",
                cache: "no-store",
                signal: controller.signal,
                headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
            });
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get("location");
                if (!location || redirect === MAX_REDIRECTS) {
                    throw new Error("The figure image redirect was rejected.");
                }
                url = validateFigureSourceUrl(new URL(location, url).toString());
                continue;
            }
            if (!response.ok) {
                throw new Error(`The figure image could not be loaded (${response.status}).`);
            }
            const contentLength = Number(response.headers.get("content-length"));
            if (
                Number.isFinite(contentLength) &&
                contentLength > MAX_FIGURE_BYTES
            ) {
                throw new Error("Figure images must be no larger than 5 MB.");
            }
            return validateFigureBytes(
                await readImageBody(response),
                response.headers.get("content-type")?.split(";")[0],
            );
        } finally {
            clearTimeout(timeout);
        }
    }
    throw new Error("The figure image could not be loaded.");
}

export function figureImageDataUrl(image: ValidatedFigureImage) {
    return `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`;
}
