"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./brief.module.scss";

/** Copies this brief's address. Falls back to selecting nothing on failure. */
export default function BriefCopyLink() {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href.split("#")[0]);
            setState("copied");
        } catch {
            setState("failed");
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState("idle"), 2400);
    };

    return (
        <button
            type="button"
            className={styles.copyLink}
            data-state={state}
            onClick={copy}
            aria-live="polite"
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
            {state === "copied"
                ? "Link copied"
                : state === "failed"
                  ? "Copy the address bar"
                  : "Copy link"}
        </button>
    );
}
