// What people read when a limit stops them. While paid plans are hidden there
// is nothing to upgrade to, so messages say when the allowance comes back and
// point to the Contact page.
import { PAYMENTS_VISIBLE } from "./payments";

type MonthlyFeature = "discover" | "search" | "chat";

const NOUNS: Record<MonthlyFeature, [string, string]> = {
    discover: ["discovery", "discoveries"],
    search: ["paper search", "paper searches"],
    chat: ["paper assistant question", "paper assistant questions"],
};

/** Where "Need more?" goes while paid plans are hidden. */
export const NEED_MORE_HREF = "/contact";
export const NEED_MORE_LABEL = "Need more? Contact us";

/** "November 1": monthly limits start over on the 1st (UTC). */
export function limitRenewsOn(now = new Date()) {
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
}

/** "5 discoveries", "1 paper search". */
export function countOf(feature: MonthlyFeature, count: number) {
    const [one, many] = NOUNS[feature];
    return `${count} ${count === 1 ? one : many}`;
}

/**
 * "You've used your 5 discoveries for this month. You get more on November 1."
 * `upgrade` adds the Pro line, only while paid plans show.
 */
export function monthlyLimitMessage(
    feature: MonthlyFeature,
    limit: number | null | undefined,
    { now = new Date(), upgrade = false }: { now?: Date; upgrade?: boolean } = {},
) {
    const what =
        typeof limit === "number" && limit > 0
            ? countOf(feature, limit)
            : NOUNS[feature][1];
    const message = `You've used your ${what} for this month. You get more on ${limitRenewsOn(now)}.`;
    return PAYMENTS_VISIBLE && upgrade
        ? `${message} Upgrade to Researcher Pro for more.`
        : message;
}

/** A feature the person's plan doesn't include. */
export function notOnPlanMessage(feature: string) {
    return PAYMENTS_VISIBLE
        ? `${feature} is available with Researcher Pro.`
        : `${feature} isn't available on your account.`;
}
