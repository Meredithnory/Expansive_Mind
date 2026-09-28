"use client";

import React, { useState } from "react";
import styles from "../styles/paperbox.module.scss";

const SHOWN_AUTHORS = 3;

/** First three authors, with the rest one tap away. */
export default function PaperAuthors({ authors }: { authors: string[] }) {
    const [expanded, setExpanded] = useState(false);
    const names = authors.map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) return null;
    const hiddenCount = names.length - SHOWN_AUTHORS;
    // Hiding a single name saves nothing.
    const collapsible = hiddenCount > 1;
    const shown =
        collapsible && !expanded ? names.slice(0, SHOWN_AUTHORS) : names;
    // Sources list "Last, First", so commas between authors would blur names.
    return (
        <div className={styles.authors}>
            {shown.join(" · ")}
            {collapsible && (
                <button
                    type="button"
                    className={styles.authorsToggle}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((open) => !open)}
                >
                    {expanded ? "Show fewer" : `+${hiddenCount} authors`}
                </button>
            )}
        </div>
    );
}
