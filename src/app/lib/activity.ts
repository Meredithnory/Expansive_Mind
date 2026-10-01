// What people do on the site, for /admin/live: page views plus a few named
// actions. No paper text; guests are a scrambled key. Kept 30 days.
import { audienceLabel, audiencePage, type AudiencePage } from "./audience";
import type { RatingScore } from "./rating";

export const ACTIVITY_KINDS = ["page_view", "discover", "search"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_DAYS = 30;
/** Someone counts as on the site when their tab reported in this recently. */
export const LIVE_WINDOW_MS = 45_000;
export const FEED_HOURS = [1, 24, 168] as const;
export type FeedHours = (typeof FEED_HOURS)[number];

const DETAIL_MAX = 300;
const PATH_MAX = 200;

export type ActivityInput = {
    kind: ActivityKind;
    page: AudiencePage;
    path: string | null;
    detail: string | null;
};

/** One line of plain text: no control characters, collapsed spaces, capped. */
export function cleanActivityText(value: unknown, max: number) {
    if (typeof value !== "string") return "";
    return value
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

/** A tracked site path without its query or hash, or null for pages we don't count. */
export function activityPath(value: unknown): { page: AudiencePage; path: string } | null {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
        return null;
    }
    const path = cleanActivityText(value.split(/[?#]/)[0], PATH_MAX).replace(/\/+$/, "") || "/";
    const page = audiencePage(path);
    return page ? { page, path } : null;
}

export function normalizeActivity(body: unknown): ActivityInput | null {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    if (data.kind === "page_view") {
        const where = activityPath(data.path);
        return where ? { kind: "page_view", ...where, detail: null } : null;
    }
    if (data.kind === "discover" || data.kind === "search") {
        const detail = cleanActivityText(data.detail, DETAIL_MAX);
        if (!detail) return null;
        return { kind: data.kind, page: data.kind, path: null, detail };
    }
    return null;
}

export function parseFeedHours(value: string | null | undefined): FeedHours {
    const hours = Number(value);
    return (FEED_HOURS as readonly number[]).includes(hours) ? (hours as FeedHours) : 24;
}

/** "user:<id>" or "guest:<visitor key>", the handle /admin/live filters by. */
export type PersonRef = { type: "user"; id: string } | { type: "guest"; key: string };

export function parsePersonRef(value: string | null | undefined): PersonRef | null {
    const user = /^user:([a-f0-9]{24})$/.exec(value ?? "");
    if (user) return { type: "user", id: user[1] };
    const guest = /^guest:([a-f0-9]{64})$/.exec(value ?? "");
    return guest ? { type: "guest", key: guest[1] } : null;
}

export function guestName(visitorKey: string) {
    return `Guest ${visitorKey.slice(0, 4)}`;
}

export type FeedKind = ActivityKind | "rating" | "share" | "signup";

export const RATING_WORD: Record<RatingScore, string> = { bad: "Bad", fine: "Fine", good: "Good" };

/** What a feed row says happened. */
export function feedText(kind: FeedKind, page?: string | null, score?: RatingScore | null) {
    switch (kind) {
        case "page_view":
            if (page === "paper") return "Opened a paper";
            if (page === "brief") return "Opened a shared brief";
            return `Opened ${audienceLabel(page ?? "")}`;
        case "discover":
            return "Ran a discovery";
        case "search":
            return "Searched";
        case "rating":
            return score ? `Rated ${RATING_WORD[score]}` : "Rated";
        case "share":
            return "Created a share link";
        case "signup":
            return "Signed up";
    }
}

export type FeedItem = {
    id: string;
    at: string;
    kind: FeedKind;
    person: string;
    who: string;
    plan: string;
    text: string;
    /** The question, query, or rating comment. */
    detail?: string;
    path?: string;
    score?: RatingScore;
    /** For a rating: what was being rated. */
    context?: string;
};

export type PresenceRow = {
    visitorKey: string;
    userID?: unknown;
    lastSeenAt?: Date | string | null;
    lastPage?: string | null;
    away?: boolean | null;
    secondsByPage?: Record<string, number> | null;
};

export type ViewRow = {
    visitorKey: string;
    userID?: unknown;
    at: Date | string;
    page?: string | null;
    path?: string | null;
};

export type LiveVisitor = {
    visitorKey: string;
    userID: string | null;
    page: string;
    path: string | null;
    lastSeenAt: string;
    secondsToday: number;
};

/**
 * Who is on the site now. A tab reports every 15 seconds while it's visible
 * and says "away" when it's hidden or closed; a fresh page view counts too.
 */
export function liveVisitors(
    presence: PresenceRow[],
    views: ViewRow[],
    now = Date.now(),
): LiveVisitor[] {
    type Signal = { at: number; page: string | null; away: boolean; path: string | null };
    const latest = new Map<string, Signal>();
    const latestView = new Map<string, ViewRow>();
    const userByKey = new Map<string, string>();
    const secondsByKey = new Map<string, { at: number; seconds: number }>();
    const consider = (key: string, signal: Signal) => {
        const current = latest.get(key);
        if (!current || signal.at > current.at) latest.set(key, signal);
    };

    for (const row of presence) {
        const at = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : NaN;
        if (!Number.isFinite(at)) continue;
        if (row.userID) userByKey.set(row.visitorKey, String(row.userID));
        consider(row.visitorKey, { at, page: row.lastPage ?? null, away: Boolean(row.away), path: null });
        const seconds = Object.values(row.secondsByPage ?? {}).reduce(
            (sum, value) => sum + (Number(value) > 0 ? Number(value) : 0),
            0,
        );
        const known = secondsByKey.get(row.visitorKey);
        if (!known || at > known.at) secondsByKey.set(row.visitorKey, { at, seconds });
    }
    for (const view of views) {
        const at = new Date(view.at).getTime();
        if (!Number.isFinite(at)) continue;
        if (view.userID) userByKey.set(view.visitorKey, String(view.userID));
        consider(view.visitorKey, { at, page: view.page ?? null, away: false, path: view.path ?? null });
        const known = latestView.get(view.visitorKey);
        if (!known || at > new Date(known.at).getTime()) latestView.set(view.visitorKey, view);
    }

    const live: LiveVisitor[] = [];
    for (const [visitorKey, signal] of latest) {
        if (signal.away || now - signal.at > LIVE_WINDOW_MS || !signal.page) continue;
        const view = latestView.get(visitorKey);
        live.push({
            visitorKey,
            userID: userByKey.get(visitorKey) ?? null,
            page: signal.page,
            path: signal.path ?? (view?.page === signal.page ? view.path ?? null : null),
            lastSeenAt: new Date(signal.at).toISOString(),
            secondsToday: secondsByKey.get(visitorKey)?.seconds ?? 0,
        });
    }
    return live.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/** Fire-and-forget from the browser. Never throws, never blocks the page. */
export function logActivity(input: { kind: ActivityKind; path?: string; detail?: string }) {
    if (typeof window === "undefined") return;
    void fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        keepalive: true,
    }).catch(() => undefined);
}
