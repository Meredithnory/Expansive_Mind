"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import posthog from "posthog-js";
import {
    ANONYMOUS_SESSION,
    type QuotaSnapshot,
    type SessionSnapshot,
    type SessionUser,
} from "./session-types";

export type {
    QuotaSnapshot,
    QuotaValue,
    SessionSnapshot,
    SessionUser,
} from "./session-types";

type SessionValue = {
    isLoggedIn: boolean;
    loading: boolean;
    user: SessionUser | null;
    quotas: QuotaSnapshot | null;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

type SessionState = SessionSnapshot & { loading: boolean };

export function SessionProvider({ children }: { children: ReactNode }) {
    const refreshVersion = useRef(0);
    const [session, setSession] = useState<SessionState>({
        ...ANONYMOUS_SESSION,
        loading: true,
    });

    const refresh = useCallback(async () => {
        const version = ++refreshVersion.current;
        try {
            const response = await fetch("/api/session", {
                cache: "no-store",
            });
            if (response.ok) {
                const data = (await response.json()) as {
                    user: SessionUser;
                    quotas: QuotaSnapshot;
                };
                if (version === refreshVersion.current) {
                    setSession({
                        isLoggedIn: true,
                        user: data.user,
                        quotas: data.quotas,
                        loading: false,
                    });
                }
            } else {
                if (version === refreshVersion.current) {
                    setSession({ ...ANONYMOUS_SESSION, loading: false });
                }
            }
        } catch {
            if (version === refreshVersion.current) {
                setSession({ ...ANONYMOUS_SESSION, loading: false });
            }
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!session.user?.id) return;
        posthog.identify(String(session.user.id), {
            plan: session.user.plan,
        });
    }, [session.user?.id, session.user?.plan]);

    const logout = useCallback(async () => {
        refreshVersion.current += 1;
        await fetch("/api/logout", { method: "POST" });
        setSession({ ...ANONYMOUS_SESSION, loading: false });
        posthog.reset();
    }, []);

    const value = useMemo(
        () => ({
            ...session,
            refresh,
            logout,
        }),
        [session, refresh, logout],
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const session = useContext(SessionContext);
    if (!session) {
        throw new Error("useSession must be used within SessionProvider");
    }
    return session;
}
