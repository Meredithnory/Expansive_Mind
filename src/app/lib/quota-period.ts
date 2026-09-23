import type { Plan, QuotaFeature } from "./plan-config";

export const QUOTA_FEATURES: QuotaFeature[] = [
    "search",
    "discover",
    "chat",
    "scholar_search",
    "projects",
];

export const QUOTA_LABELS: Record<QuotaFeature, string> = {
    search: "Searches",
    discover: "Discovery",
    chat: "AI questions",
    scholar_search: "Scholar searches",
    projects: "Projects",
};

export function monthKey(now: Date) {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quotaPeriod(plan: Plan, feature: QuotaFeature, now: Date) {
    if (plan === "guest" && (feature === "discover" || feature === "projects")) {
        return "lifetime";
    }
    if (plan === "guest") {
        return `${monthKey(now)}-${String(now.getUTCDate()).padStart(2, "0")}`;
    }
    if (plan === "free" && (feature === "discover" || feature === "projects")) {
        return "lifetime";
    }
    return monthKey(now);
}

export function formatQuotaPeriod(period: string) {
    if (period === "lifetime") return "Lifetime";
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) return period;
    return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, 1),
    ).toLocaleString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}
