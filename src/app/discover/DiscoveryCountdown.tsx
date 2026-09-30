"use client";

import { useEffect, useState } from "react";
import { discoveryCountdown, TYPICAL_RUN_SECONDS } from "./discovery-countdown";
import styles from "./discover.module.scss";

/** Time left while a discovery runs, from when the question was sent. */
export default function DiscoveryCountdown({ startedAt }: { startedAt: number }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => window.clearInterval(timer);
    }, []);

    const state = discoveryCountdown((now - startedAt) / 1_000);
    return (
        <div className={styles.workingCountdown} data-overtime={state.overtime || undefined}>
            {/* Screen readers hear the estimate once, not a tick every second. */}
            <p className={styles.srOnly}>
                A discovery usually takes about {Math.round(TYPICAL_RUN_SECONDS / 60 * 2) / 2} minutes.
            </p>
            <div className={styles.workingCountdownRow} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>{state.text}</span>
            </div>
            <span className={styles.workingCountdownTrack} aria-hidden="true">
                <span
                    className={styles.workingCountdownFill}
                    style={{ transform: `scaleX(${state.progress})` }}
                />
            </span>
        </div>
    );
}
