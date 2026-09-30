"use client";
import { useEffect, useState } from "react";
import styles from "../styles/chatbox.module.scss";
import { THINKING_WORD_INTERVAL_MS, nextThinkingWord } from "./thinking-words";

/**
 * Shown while the paper assistant writes an answer: pink dots plus a science
 * verb ("Titrating…") that changes every few seconds. Reduced motion keeps
 * one word for the whole wait.
 */
export default function ThinkingIndicator() {
    const [word, setWord] = useState(() => nextThinkingWord(null));

    useEffect(() => {
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            return;
        }
        const timer = window.setInterval(
            () => setWord((current) => nextThinkingWord(current)),
            THINKING_WORD_INTERVAL_MS,
        );
        return () => window.clearInterval(timer);
    }, []);

    return (
        <div
            className={styles.typing}
            role="status"
            aria-live="polite"
            aria-label="Assistant is thinking"
        >
            <span className={styles.typingDot} aria-hidden="true"></span>
            <span className={styles.typingDot} aria-hidden="true"></span>
            <span className={styles.typingDot} aria-hidden="true"></span>
            {/* Screen readers hear this once instead of every word change. */}
            <span className={styles.srOnly}>Reading the paper…</span>
            <span key={word} className={styles.thinkingWord} aria-hidden="true">
                {word}…
            </span>
        </div>
    );
}
