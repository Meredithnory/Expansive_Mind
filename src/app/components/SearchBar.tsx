import React, { SetStateAction, useRef } from "react";
import styles from "./styles/searchbar.module.scss";
import clsx from "clsx";
import {
    getGhostCompletionSuffix,
    searchQueriesMatch,
} from "../lib/search-suggest";

export type SearchAccentSource = "all" | "nih" | "springer" | "scholar";

const ACCENT_CLASS: Record<Exclude<SearchAccentSource, "all">, string> = {
    nih: styles.nih,
    springer: styles.springer,
    scholar: styles.scholar,
};

interface SearchProps {
    searchValue: string;
    setSearchValue: React.Dispatch<SetStateAction<string>>;
    handleSubmit: (queryOverride?: string) => void;
    className?: string;
    ghostCompletion?: string | null;
    onAcceptGhost?: () => void;
    inputId?: string;
    accentSource?: SearchAccentSource;
}

const SearchBar = ({
    searchValue,
    setSearchValue,
    handleSubmit,
    className,
    ghostCompletion = null,
    onAcceptGhost,
    inputId,
    accentSource = "all",
}: SearchProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const ghostSuffix = getGhostCompletionSuffix(searchValue, ghostCompletion);

    const acceptGhost = () => {
        if (!ghostCompletion) return;
        setSearchValue(ghostCompletion);
        onAcceptGhost?.();
        inputRef.current?.focus();
    };

    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ): void => {
        const input = inputRef.current;
        const atEnd =
            input &&
            input.selectionStart === input.value.length &&
            input.selectionEnd === input.value.length;

        if (
            ghostCompletion &&
            !searchQueriesMatch(searchValue, ghostCompletion) &&
            ((event.key === "Tab" && ghostSuffix) ||
                (event.key === "ArrowRight" && atEnd && ghostSuffix))
        ) {
            event.preventDefault();
            acceptGhost();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div
            className={clsx(
                styles.searchbox,
                accentSource !== "all" && ACCENT_CLASS[accentSource],
                className,
            )}
        >
            <div className={styles.inputWrap}>
                {ghostSuffix ? (
                    <div className={styles.ghostText} aria-hidden="true">
                        <span className={styles.ghostMirror}>{searchValue}</span>
                        <span className={styles.ghostSuffix}>{ghostSuffix}</span>
                    </div>
                ) : null}
                <input
                    id={inputId}
                    ref={inputRef}
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search papers"
                    aria-label="Search papers"
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>
            <div className={styles.vertline} />
            <button
                type="button"
                onClick={() => handleSubmit()}
                className={styles.button}
                aria-label="Search"
            >
                <svg
                    className={styles.icon}
                    viewBox="0 0 39 43"
                    aria-hidden
                >
                    <path
                        d="M14.062 30.4537C17.2199 30.4537 20.1248 29.3127 22.4721 27.4094L36.1595 42.2316L39 39.1547L25.3126 24.3336C27.0704 21.7918 28.124 18.6463 28.124 15.2268C28.124 6.81727 21.8283 0 14.062 0C6.29577 0 0 6.81727 0 15.2268C0 23.6364 6.29577 30.4537 14.062 30.4537ZM14.062 4.35052C19.6004 4.35052 24.1063 9.22964 24.1063 15.2268C24.1063 21.224 19.6004 26.1031 14.062 26.1031C8.52359 26.1031 4.01772 21.224 4.01772 15.2268C4.01772 9.22964 8.52359 4.35052 14.062 4.35052Z"
                        fill="currentColor"
                    />
                </svg>
            </button>
        </div>
    );
};

export default SearchBar;
