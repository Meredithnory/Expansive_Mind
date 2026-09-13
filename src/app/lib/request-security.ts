import type { NextRequest } from "next/server";

export function hasValidMutationOrigin(request: NextRequest) {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    if (origin) return origin === request.nextUrl.origin;
    const referer = request.headers.get("referer");
    if (referer) {
        try { return new URL(referer).origin === request.nextUrl.origin; }
        catch { return false; }
    }
    // Non-browser clients have no ambient browser cookies or Fetch Metadata.
    return true;
}

export class InvalidJsonRequest extends Error {
    constructor(public status: number, message: string) { super(message); }
}

/** Bound actual bytes, including chunked bodies without a Content-Length header. */
export async function readBoundedJson(request: Request, maxBytes = 32768): Promise<Record<string, unknown>> {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new InvalidJsonRequest(415, "Expected application/json.");
    const reader = request.body?.getReader();
    if (!reader) throw new InvalidJsonRequest(400, "JSON body required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const {value,done} = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) { await reader.cancel(); throw new InvalidJsonRequest(413, "Request body too large."); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try {
        const value = JSON.parse(new TextDecoder().decode(bytes));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        return value;
    } catch { throw new InvalidJsonRequest(400, "Expected a JSON object."); }
}
