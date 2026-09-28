import { randomBytes } from "node:crypto";

export const GROUP_NAME_MAX = 60;
export const GROUP_NOTE_MAX = 1_000;
export const GROUP_COMMENT_MAX = 2_000;
export const GROUP_MEMBER_LIMIT = 50;
export const GROUPS_PER_USER_LIMIT = 20;
export const GROUP_POST_HIGHLIGHT_LIMIT = 20;
export const GROUP_FEED_LIMIT = 50;

const clean = (value: unknown) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

export function parseGroupName(value: unknown): string | null {
    const name = clean(value);
    return name && name.length <= GROUP_NAME_MAX ? name : null;
}

/** Free text that keeps line breaks (notes, comments). */
export function parseGroupText(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const text = value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text.length <= max ? text : null;
}

/** 128-bit URL-safe invite secret. */
export function newInviteCode(): string {
    return randomBytes(16).toString("base64url");
}

export function isInviteCode(value: unknown): value is string {
    return typeof value === "string" && /^[A-Za-z0-9_-]{22}$/.test(value);
}
