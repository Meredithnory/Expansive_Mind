import { randomBytes } from "crypto";
import { SHARE_SLUG_PATTERN } from "./paper-sources";

// 12 URL-safe chars ≈ 71 bits of entropy — unguessable but short enough
// to keep share links tidy.
export function generateShareSlug(): string {
    return randomBytes(9).toString("base64url");
}

export function isValidShareSlug(slug: string): boolean {
    return SHARE_SLUG_PATTERN.test(slug);
}
