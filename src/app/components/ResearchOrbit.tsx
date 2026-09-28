"use client";

import { useLayoutEffect, useRef } from "react";
import type { ResearchMode } from "../lib/research-mode";
import styles from "./styles/research-orbit.module.scss";

/** One full turn of the ring. */
const TURN_MS = 40_000;

/**
 * The slow ring of dots behind every page. The root layout renders one
 * (`site`); Research, About, and Contact render their own and the site copy
 * steps aside. Its angle comes from the clock, so the loading
 * screen, the page, and a Discovery ↔ Search switch all show it mid-turn
 * instead of restarting it.
 */
export default function ResearchOrbit({
    mode = "discover",
    site = false,
}: {
    mode?: ResearchMode;
    /** The copy in the root layout: behind every page, never remounted. */
    site?: boolean;
}) {
    const ringRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const ring = ringRef.current;
        if (!ring) return;
        ring.style.animationDelay = `-${Date.now() % TURN_MS}ms`;
        ring.dataset.ready = "true";
    }, []);

    return (
        <div
            className={site ? `${styles.orbit} ${styles.site}` : styles.orbit}
            data-mode={mode}
            data-research-orbit=""
            data-site-orbit={site ? "" : undefined}
            aria-hidden="true"
        >
            <div className={styles.glow} />
            <div ref={ringRef} className={styles.ring}>
                <span />
                <span />
                <span />
                <span />
            </div>
        </div>
    );
}
