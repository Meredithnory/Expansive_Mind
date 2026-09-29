"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import type { ResearchMode } from "../lib/research-mode";
import styles from "./styles/research-mode-toggle.module.scss";

const MODES: Array<{ id: ResearchMode; label: string }> = [
    { id: "discover", label: "Discovery" },
    { id: "search", label: "Search" },
];

const SparkleIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
        />
    </svg>
);

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.2" />
        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

type ResearchModeToggleProps = {
    mode: ResearchMode;
    onChange: (mode: ResearchMode) => void;
};

/** Discovery | Search, centered above the research question. */
export default function ResearchModeToggle({
    mode,
    onChange,
}: ResearchModeToggleProps) {
    const baseId = useId();
    const listRef = useRef<HTMLDivElement>(null);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next: ResearchMode = event.key === "ArrowLeft" ? "discover" : "search";
        onChange(next);
        listRef.current
            ?.querySelector<HTMLButtonElement>(`[data-mode-option="${next}"]`)
            ?.focus();
    };

    return (
        <div className={styles.chrome} data-research-mode-chrome data-mode={mode}>
            <div
                ref={listRef}
                className={styles.tabs}
                role="tablist"
                aria-label="Research mode"
            >
                {MODES.map((option) => {
                    const selected = option.id === mode;
                    return (
                        <button
                            key={option.id}
                            id={`${baseId}-${option.id}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            tabIndex={selected ? 0 : -1}
                            className={styles.tab}
                            data-mode-option={option.id}
                            onClick={() => {
                                if (!selected) onChange(option.id);
                            }}
                            onKeyDown={onKeyDown}
                        >
                            {option.id === "discover" ? <SparkleIcon /> : <SearchIcon />}
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
