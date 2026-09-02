import { randomBytes } from "crypto";

// 12 URL-safe chars ≈ 71 bits of entropy — unguessable but short enough
// to keep share links tidy.
export function generateShareSlug(): string {
    return randomBytes(9).toString("base64url");
}

export function isValidShareSlug(slug: string): boolean {
    return /^[A-Za-z0-9_-]{10,24}$/.test(slug);
}
