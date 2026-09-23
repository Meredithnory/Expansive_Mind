/**
 * Tracks which way the user is moving through browser history so the page
 * shell can animate spatially: back slides in from the left, forward (and
 * drilling into a detail page) slides in from the right, hub-to-hub jumps and
 * initial loads use the plain fade.
 *
 * Primary source is the Navigation API (`navigate` events carry the exact
 * destination entry index for traversals). Browsers without it fall back to a
 * per-entry index stamped into `history.state`; Next.js may drop that stamp on
 * some internal replaces, in which case the direction degrades to "none".
 */

export type NavDirection = "none" | "back" | "forward";

type PendingDirection = NavDirection | "push";

interface NavigateEventLike extends Event {
    navigationType: "push" | "replace" | "reload" | "traverse";
    hashChange: boolean;
    downloadRequest: string | null;
    destination: { index: number; url: string };
}

interface NavigationLike {
    currentEntry: { index: number } | null;
    addEventListener(
        type: "navigate",
        listener: (event: NavigateEventLike) => void,
    ): void;
}

const INDEX_KEY = "emNavIndex";
/** A queued direction older than this is treated as stale and ignored. */
const STALE_MS = 10_000;

let pendingDirection: PendingDirection = "none";
let pendingAt = 0;
let listenersInstalled = false;
let usingNavigationApi = false;
let directionResetTimer: ReturnType<typeof setTimeout> | null = null;
/** Fallback mode only: index of the history entry we last knew to be current. */
let lastKnownIndex: number | null = null;

/** Direction of a history traversal from entry `from` to entry `to`. */
export function directionFromTraverse(from: number, to: number): NavDirection {
    if (to < from) return "back";
    if (to > from) return "forward";
    return "none";
}

/**
 * Direction for a brand-new navigation (push). Hubs — the root and any
 * single-segment route like `/discover` or `/projects` — are peers and fade.
 * Deeper routes such as `/projects/abc` or `/paperchatbot/…` are detail pages
 * and enter from the right so a later back-swipe reads as returning left.
 */
export function directionForPush(pathname: string): NavDirection {
    const depth = pathname.split("/").filter(Boolean).length;
    return depth > 1 ? "forward" : "none";
}

/** Resolve the queued direction for the page that is about to mount. */
export function resolvePendingDirection(
    pending: PendingDirection,
    queuedAt: number,
    now: number,
    pathname: string,
): NavDirection {
    if (now - queuedAt > STALE_MS) return "none";
    if (pending === "push") return directionForPush(pathname);
    return pending;
}

function queue(direction: PendingDirection) {
    pendingDirection = direction;
    pendingAt = Date.now();
    if (direction !== "push") applyDocumentDirection(direction);
}

function applyDocumentDirection(direction: NavDirection) {
    if (typeof document === "undefined") return;
    if (directionResetTimer) clearTimeout(directionResetTimer);
    if (direction === "none") {
        delete document.documentElement.dataset.navDirection;
        return;
    }

    document.documentElement.dataset.navDirection = direction;
    directionResetTimer = setTimeout(() => {
        delete document.documentElement.dataset.navDirection;
        directionResetTimer = null;
    }, 250);
}

function readNavigationApi(): NavigationLike | null {
    if (typeof window === "undefined") return null;
    const navigation = (window as unknown as { navigation?: NavigationLike })
        .navigation;
    return navigation && typeof navigation.addEventListener === "function"
        ? navigation
        : null;
}

function readStateIndex(state: unknown): number | null {
    if (!state || typeof state !== "object") return null;
    const value = (state as Record<string, unknown>)[INDEX_KEY];
    return typeof value === "number" ? value : null;
}

/** Install the global listeners once per page session. Safe to call repeatedly. */
export function installNavDirectionListeners() {
    if (listenersInstalled || typeof window === "undefined") return;
    listenersInstalled = true;

    const navigation = readNavigationApi();
    if (navigation) {
        usingNavigationApi = true;
        navigation.addEventListener("navigate", (event) => {
            if (event.hashChange || event.downloadRequest !== null) return;
            if (event.navigationType === "traverse") {
                const from = navigation.currentEntry?.index ?? -1;
                queue(directionFromTraverse(from, event.destination.index));
                return;
            }
            if (event.navigationType === "push") {
                queue("push");
                applyDocumentDirection(
                    directionForPush(
                        new URL(event.destination.url, window.location.href)
                            .pathname,
                    ),
                );
                return;
            }
            queue("none");
        });
        return;
    }

    window.addEventListener("popstate", (event) => {
        const next = readStateIndex(event.state);
        if (next === null || lastKnownIndex === null) {
            queue("none");
        } else {
            queue(directionFromTraverse(lastKnownIndex, next));
        }
        if (next !== null) lastKnownIndex = next;
    });
}

/**
 * Read (without clearing) the direction for a page shell that is rendering
 * now. Safe to call during render; returns "none" on the server.
 */
export function peekNavDirection(pathname: string): NavDirection {
    if (typeof window === "undefined") return "none";
    if (!usingNavigationApi && pendingDirection === "none") {
        // Fallback mode: a mount with no popstate and no index on the current
        // entry is a fresh push — unless this is the very first mount.
        const isNewEntry = readStateIndex(window.history.state) === null;
        if (isNewEntry && lastKnownIndex !== null) {
            return directionForPush(pathname);
        }
        return "none";
    }
    return resolvePendingDirection(pendingDirection, pendingAt, Date.now(), pathname);
}

/**
 * Called after the shell has mounted: clears the queued direction and, in
 * fallback mode, stamps the current history entry with its index.
 */
export function commitNavDirection() {
    if (typeof window === "undefined") return;
    pendingDirection = "none";
    if (usingNavigationApi) return;

    const state = window.history.state;
    const existing = readStateIndex(state);
    if (existing !== null) {
        lastKnownIndex = existing;
        return;
    }
    const next = (lastKnownIndex ?? -1) + 1;
    lastKnownIndex = next;
    try {
        const base =
            state && typeof state === "object"
                ? (state as Record<string, unknown>)
                : {};
        // No URL argument: Next.js only re-dispatches router state when a URL is
        // passed, so this stays a silent metadata update.
        window.history.replaceState({ ...base, [INDEX_KEY]: next }, "");
    } catch {
        // Some browsers throw on rapid replaceState calls; direction just degrades.
    }
}
