"use client";

import { useCallback, useId, type KeyboardEvent } from "react";
import type { ResearchMode } from "../lib/research-mode";
import styles from "./styles/research-mode-toggle.module.scss";

const COPY: Record<
    ResearchMode,
    {
        title: string;
        job: string;
        subtitle: string;
        tone: "discover" | "search";
    }
> = {
    discover: {
        title: "Discovery",
        job: "Cited brief",
        subtitle:
            "Ask one research question → findings, gaps, and startup opportunities.",
        tone: "discover",
    },
    search: {
        title: "Search",
        job: "Find papers",
        subtitle: "Look up papers across the databases.",
        tone: "search",
    },
};

type ResearchModeToggleProps = {
    mode: ResearchMode;
    onChange: (mode: ResearchMode) => void;
};

export default function ResearchModeToggle({
    mode,
    onChange,
}: ResearchModeToggleProps) {
    const titleId = useId();
    const subtitleId = useId();
    const switchId = useId();
    const checked = mode === "search";
    const copy = COPY[mode];

    const flip = useCallback(() => {
        onChange(mode === "discover" ? "search" : "discover");
    }, [mode, onChange]);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            flip();
            return;
        }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (mode !== "discover") onChange("discover");
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            if (mode !== "search") onChange("search");
        }
    };

    return (
        <div className={styles.chrome} data-research-mode-chrome data-mode={mode}>
            <div className={styles.row} data-mode={mode}>
                <div className={styles.copy}>
                    <p id={titleId} className={styles.title} data-tone={copy.tone}>
                        {copy.title}
                    </p>
                    <p className={styles.job} data-tone={copy.tone} aria-hidden="true">
                        {copy.job}
                    </p>
                    <p id={subtitleId} className={styles.subtitle} data-tone={copy.tone}>
                        {copy.subtitle}
                    </p>
                </div>

                <button
                    id={switchId}
                    type="button"
                    role="switch"
                    className={styles.switch}
                    aria-checked={checked}
                    aria-labelledby={titleId}
                    aria-describedby={subtitleId}
                    data-mode={mode}
                    onClick={flip}
                    onKeyDown={onKeyDown}
                >
                    <span className={styles.track} aria-hidden="true">
                        <span className={styles.trackLabel} data-side="left">
                            Discovery
                        </span>
                        <span className={styles.trackLabel} data-side="right">
                            Search
                        </span>
                        <span className={styles.thumb} />
                    </span>
                    <span className={styles.visuallyHidden}>
                        {checked
                            ? "Search mode. Switch to Discovery."
                            : "Discovery mode. Switch to Search."}
                    </span>
                </button>
            </div>
        </div>
    );
}
