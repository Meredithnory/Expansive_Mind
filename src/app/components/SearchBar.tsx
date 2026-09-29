import React, { type ReactNode, SetStateAction, useRef } from "react";
import styles from "./styles/searchbar.module.scss";
import clsx from "clsx";
import {
    getGhostCompletionSuffix,
    searchQueriesMatch,
} from "../lib/search-suggest";

export type SearchAccentSource =
    | "all"
    | "nih"
    | "springer"
    | "scholar"
    | "europe-pmc"
    | "crossref";

const ACCENT_CLASS: Record<Exclude<SearchAccentSource, "all">, string> = {
    nih: styles.nih,
    springer: styles.springer,
    scholar: styles.scholar,
    "europe-pmc": styles.europePmc,
    crossref: styles.crossref,
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
    searching?: boolean;
    /** Shown inside the box under the input (the landing's filters). */
    footer?: ReactNode;
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
    searching = false,
    footer,
}: SearchProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const ghostSuffix = getGhostCompletionSuffix(searchValue, ghostCompletion);
    const canAcceptGhost =
        Boolean(ghostCompletion) &&
        !searchQueriesMatch(searchValue, ghostCompletion ?? "");
    const hasReplacement = canAcceptGhost && !ghostSuffix;

    const acceptGhost = (submit = false) => {
        if (!ghostCompletion) return;
        setSearchValue(ghostCompletion);
        onAcceptGhost?.();
        if (submit) {
            handleSubmit(ghostCompletion);
            return;
        }
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
            canAcceptGhost &&
            ((event.key === "Tab" && (ghostSuffix || hasReplacement)) ||
                (event.key === "ArrowRight" && atEnd && ghostSuffix))
        ) {
            event.preventDefault();
            acceptGhost();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            if (canAcceptGhost) {
                acceptGhost(true);
                return;
            }
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
            <div className={styles.row}>
                <svg
                    className={styles.leadIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                >
                    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.2" />
                    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
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
                        placeholder="Search by topic, title, or author…"
                        aria-label="Search for papers"
                        autoComplete="off"
                        spellCheck
                    />
                    {hasReplacement && ghostCompletion ? (
                        <button
                            type="button"
                            className={styles.didYouMean}
                            onClick={() => acceptGhost()}
                        >
                            Did you mean <strong>{ghostCompletion}</strong>
                        </button>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() =>
                        canAcceptGhost
                            ? acceptGhost(true)
                            : handleSubmit()
                    }
                    className={clsx(
                        styles.button,
                        searching && styles.buttonSearching,
                    )}
                    aria-label={searching ? "Searching" : "Search"}
                    disabled={searching || !searchValue.trim()}
                >
                    <svg
                        className={styles.buttonIcon}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className={styles.buttonLabel}>Search</span>
                </button>
            </div>
            {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
    );
};

export default SearchBar;
