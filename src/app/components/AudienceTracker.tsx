"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { audiencePage, type AudiencePage } from "../lib/audience";

const PING_MS = 15_000;

function sendVisit(
    page: AudiencePage,
    seconds: number,
    next?: AudiencePage | null,
    preferBeacon = false,
) {
    const body = JSON.stringify({
        page,
        seconds,
        ...(next ? { next } : {}),
    });
    if (preferBeacon && navigator.sendBeacon) {
        const queued = navigator.sendBeacon(
            "/api/audience",
            new Blob([body], { type: "application/json" }),
        );
        if (queued) return;
    }
    void fetch("/api/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
    }).catch(() => undefined);
}

export default function AudienceTracker() {
    const pathname = usePathname();
    const pageRef = useRef<AudiencePage | null>(null);
    const startedRef = useRef(0);

    useEffect(() => {
        const next = audiencePage(pathname || "/");
        const previous = pageRef.current;
        const elapsed = startedRef.current
            ? Math.round((Date.now() - startedRef.current) / 1000)
            : 0;
        if (previous && (elapsed > 0 || (next && next !== previous))) {
            sendVisit(previous, elapsed, next && next !== previous ? next : null);
        }
        pageRef.current = next;
        startedRef.current = next ? Date.now() : 0;
        if (!next) return;

        const flush = (preferBeacon = false) => {
            const page = pageRef.current;
            if (!page || !startedRef.current) return;
            const seconds = Math.round((Date.now() - startedRef.current) / 1000);
            startedRef.current = Date.now();
            if (seconds > 0) sendVisit(page, seconds, null, preferBeacon);
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") flush(true);
            else startedRef.current = Date.now();
        };
        const onHide = () => flush(true);
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") flush();
        }, PING_MS);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onHide);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", onHide);
        };
    }, [pathname]);

    return null;
}
