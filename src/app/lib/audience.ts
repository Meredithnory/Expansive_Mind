import { eachUtcDay } from "./admin-overview";

export const AUDIENCE_PAGES = {
    home: "Home",
    discover: "Discover",
    search: "Search",
    library: "Library",
    projects: "Projects",
    paper: "Paper",
    pricing: "Pricing",
    account: "Account",
    company: "About & contact",
    start: "Get started",
} as const;

export type AudiencePage = keyof typeof AUDIENCE_PAGES;

export const MAX_PING_SECONDS = 40;

export function audiencePage(pathname: string): AudiencePage | null {
    const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
    if (path.startsWith("/admin") || path.startsWith("/api")) return null;
    if (path === "/") return "home";
    if (path.startsWith("/discover")) return "discover";
    if (path.startsWith("/search")) return "search";
    if (path.startsWith("/saved")) return "library";
    if (path.startsWith("/projects")) return "projects";
    if (
        path.startsWith("/paper") ||
        path.startsWith("/brief") ||
        path.startsWith("/shared")
    ) {
        return "paper";
    }
    if (path.startsWith("/pricing")) return "pricing";
    if (path.startsWith("/login") || path.startsWith("/signup")) return "account";
    if (path.startsWith("/about") || path.startsWith("/contact")) return "company";
    if (path.startsWith("/get-started")) return "start";
    return null;
}

export function audienceLabel(page: string) {
    return AUDIENCE_PAGES[page as AudiencePage] || page;
}

export function clampAudienceSeconds(value: unknown) {
    const seconds = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.min(MAX_PING_SECONDS, Math.round(seconds));
}

export function moveKey(from: AudiencePage, to: AudiencePage) {
    return `${from}__${to}`;
}

export type AudienceAccount = {
    name: string;
    email: string;
    plan: string;
};

export type AudienceRecord = {
    day: string;
    visitorKey: string;
    userId?: string;
    signedIn?: boolean;
    account?: AudienceAccount;
    secondsByPage?: Record<string, number>;
    moves?: Record<string, number>;
};

export type AudiencePerson = {
    id: string;
    name: string;
    email: string | null;
    plan: string | null;
    guest: boolean;
    days: string[];
    seconds: number;
    lastDay: string;
    pages: Array<{ page: string; label: string; seconds: number }>;
};

export type AudienceDaily = {
    date: string;
    visitors: number;
    seconds: number;
};

export type AudienceSummary = {
    rangeDays: number;
    visitors: number;
    signedInVisitors: number;
    seconds: number;
    daily: AudienceDaily[];
    pages: Array<{ page: string; label: string; seconds: number; visitors: number }>;
    destinations: Array<{
        from: string;
        to: string;
        label: string;
        count: number;
    }>;
    returnDays: Array<{ label: string; visitors: number }>;
    people: AudiencePerson[];
};

export function summarizeAudience(
    records: AudienceRecord[],
    days = 30,
    end = new Date(),
): AudienceSummary {
    const windowDays = new Set(eachUtcDay(days, end));
    const inWindow = records.filter((record) => windowDays.has(record.day));
    const visitorsByDay = new Map<string, Set<string>>();
    const secondsByDay = new Map<string, number>();
    const pageSeconds = new Map<string, number>();
    const pageVisitors = new Map<string, Set<string>>();
    const moves = new Map<string, number>();
    const daysByVisitor = new Map<string, Set<string>>();
    const signedIn = new Set<string>();

    for (const record of inWindow) {
        const identity = audienceIdentity(record);
        const visitors = visitorsByDay.get(record.day) ?? new Set<string>();
        visitors.add(identity);
        visitorsByDay.set(record.day, visitors);
        const seen = daysByVisitor.get(identity) ?? new Set<string>();
        seen.add(record.day);
        daysByVisitor.set(identity, seen);
        if (record.signedIn || record.userId) signedIn.add(identity);

        let daySeconds = secondsByDay.get(record.day) ?? 0;
        for (const [page, seconds] of Object.entries(record.secondsByPage ?? {})) {
            if (!(page in AUDIENCE_PAGES) || seconds <= 0) continue;
            daySeconds += seconds;
            pageSeconds.set(page, (pageSeconds.get(page) ?? 0) + seconds);
            const viewers = pageVisitors.get(page) ?? new Set<string>();
            viewers.add(identity);
            pageVisitors.set(page, viewers);
        }
        secondsByDay.set(record.day, daySeconds);

        for (const [key, count] of Object.entries(record.moves ?? {})) {
            if (count <= 0 || !key.includes("__")) continue;
            moves.set(key, (moves.get(key) ?? 0) + count);
        }
    }

    const buckets = [
        { label: "1 day", min: 1, max: 1 },
        { label: "2 days", min: 2, max: 2 },
        { label: "3–4 days", min: 3, max: 4 },
        { label: "5+ days", min: 5, max: Number.POSITIVE_INFINITY },
    ];
    const returnDays = buckets.map((bucket) => ({
        label: bucket.label,
        visitors: [...daysByVisitor.values()].filter(
            (seen) => seen.size >= bucket.min && seen.size <= bucket.max,
        ).length,
    }));

    return {
        rangeDays: days,
        visitors: daysByVisitor.size,
        signedInVisitors: signedIn.size,
        seconds: [...secondsByDay.values()].reduce((sum, value) => sum + value, 0),
        daily: eachUtcDay(days, end).map((date) => ({
            date,
            visitors: visitorsByDay.get(date)?.size ?? 0,
            seconds: secondsByDay.get(date) ?? 0,
        })),
        pages: [...pageSeconds.entries()]
            .map(([page, seconds]) => ({
                page,
                label: audienceLabel(page),
                seconds,
                visitors: pageVisitors.get(page)?.size ?? 0,
            }))
            .sort((left, right) => right.seconds - left.seconds),
        destinations: [...moves.entries()]
            .map(([key, count]) => {
                const [from, to] = key.split("__");
                return {
                    from,
                    to,
                    label: `${audienceLabel(from)} → ${audienceLabel(to)}`,
                    count,
                };
            })
            .sort((left, right) => right.count - left.count)
            .slice(0, 8),
        returnDays,
        people: audiencePeople(inWindow),
    };
}

export function audienceIdentity(record: AudienceRecord) {
    return record.userId ? `user:${record.userId}` : record.visitorKey;
}

export function audiencePeople(records: AudienceRecord[]): AudiencePerson[] {
    const grouped = new Map<
        string,
        AudienceRecord[]
    >();
    for (const record of records) {
        const identity = audienceIdentity(record);
        const rows = grouped.get(identity) ?? [];
        rows.push(record);
        grouped.set(identity, rows);
    }

    return [...grouped.entries()]
        .map(([id, rows]) => {
            const account = rows.find((row) => row.account)?.account;
            const knownAccount = Boolean(rows.some((row) => row.userId));
            const secondsByPage = new Map<string, number>();
            const days = new Set<string>();
            for (const row of rows) {
                days.add(row.day);
                for (const [page, seconds] of Object.entries(row.secondsByPage ?? {})) {
                    if (!(page in AUDIENCE_PAGES) || seconds <= 0) continue;
                    secondsByPage.set(page, (secondsByPage.get(page) ?? 0) + seconds);
                }
            }
            const pages = [...secondsByPage.entries()]
                .map(([page, seconds]) => ({
                    page,
                    label: audienceLabel(page),
                    seconds,
                }))
                .sort((left, right) => right.seconds - left.seconds);
            return {
                id,
                name: account?.name || (knownAccount ? "Unknown account" : "Guest"),
                email: account?.email ?? null,
                plan: account?.plan ?? null,
                guest: !knownAccount,
                days: [...days].sort(),
                seconds: pages.reduce((sum, page) => sum + page.seconds, 0),
                lastDay: [...days].sort().at(-1) || "",
                pages,
            };
        })
        .sort((left, right) => {
            if (left.guest !== right.guest) return left.guest ? 1 : -1;
            if (left.lastDay !== right.lastDay) return right.lastDay.localeCompare(left.lastDay);
            return right.seconds - left.seconds;
        });
}

export function formatDuration(seconds: number) {
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) return `${total}s`;
    const minutes = Math.round(total / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
