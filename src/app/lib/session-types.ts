export interface SessionUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    plan: "free" | "pro";
    isAdmin: boolean;
    subscriptionStatus: string;
}

export type QuotaValue = {
    unlimited?: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
};

export type QuotaSnapshot = Record<
    "search" | "discover" | "chat" | "scholar_search" | "projects",
    QuotaValue
>;

export type SessionSnapshot = {
    isLoggedIn: boolean;
    user: SessionUser | null;
    quotas: QuotaSnapshot | null;
};

export const ANONYMOUS_SESSION: SessionSnapshot = {
    isLoggedIn: false,
    user: null,
    quotas: null,
};
