import "server-only";
import { consumeRateLimit, requestIp } from "./rate-limit";

export type GuestCostPath = "discover" | "paper" | "search";

const DAILY_LIMITS: Record<GuestCostPath, number> = {
    discover: 1,
    paper: 12,
    search: 3,
};

export function guestDailyLimit(path: GuestCostPath) {
    return DAILY_LIMITS[path];
}

export function consumeGuestDailyCap(
    request: Request,
    path: GuestCostPath,
) {
    return consumeRateLimit({
        scope: `guest-daily-${path}`,
        identity: requestIp(request),
        limit: guestDailyLimit(path),
        windowMs: 24 * 60 * 60 * 1_000,
    });
}
