"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FormattedPaper } from "../../api/general-interfaces";
import { fetchPaperHighlights } from "../../lib/paper-highlights";
import styles from "../styles/share-paper-modal.module.scss";

interface SharePaperModalProps {
    paper: FormattedPaper;
    open: boolean;
    onClose: () => void;
}

type ShareResult = {
    slug: string;
    highlightCount: number;
};

const urlFor = (slug: string) =>
    `${window.location.origin}/shared/paper/${slug}`;

export default function SharePaperModal({
    paper,
    open,
    onClose,
}: SharePaperModalProps) {
    const [highlightCount, setHighlightCount] = useState<number | null>(null);
    const [share, setShare] = useState<ShareResult | null>(null);
    const [sharing, setSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    const loadHighlightCount = useCallback(async () => {
        const highlights = await fetchPaperHighlights({
            database: paper.source || "",
            paperId: paper.paperId,
            idName: paper.idName,
        });
        setHighlightCount(highlights.length);
    }, [paper.idName, paper.paperId, paper.source]);

    useEffect(() => {
        if (!open) return;
        setError("");
        void loadHighlightCount();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [loadHighlightCount, onClose, open]);

    const copyLink = async (result: ShareResult) => {
        await navigator.clipboard.writeText(urlFor(result.slug));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2_000);
    };

    const createAndShare = async () => {
        setSharing(true);
        setError("");
        try {
            const response = await fetch("/api/paper-shares", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    database: paper.source || "",
                    paperId: paper.paperId,
                    idName: paper.idName,
                }),
            });
            const data = (await response.json()) as ShareResult & {
                error?: string;
            };
            if (!response.ok || !data.slug) {
                throw new Error(data.error || "Could not share this paper.");
            }

            const result = {
                slug: data.slug,
                highlightCount: data.highlightCount,
            };
            setShare(result);
            setHighlightCount(result.highlightCount);
            const url = urlFor(result.slug);

            if (typeof navigator.share === "function") {
                try {
                    await navigator.share({
                        title: paper.title,
                        text: `${paper.title} — shared with ${
                            result.highlightCount
                        } annotation${
                            result.highlightCount === 1 ? "" : "s"
                        } on Expansive Mind`,
                        url,
                    });
                } catch (shareError) {
                    if (
                        !(shareError instanceof DOMException) ||
                        shareError.name !== "AbortError"
                    ) {
                        await copyLink(result);
                    }
                }
            } else {
                await copyLink(result);
            }
        } catch (shareError) {
            setError(
                shareError instanceof Error
                    ? shareError.message
                    : "Could not share this paper.",
            );
        } finally {
            setSharing(false);
        }
    };

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-paper-title"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className={styles.sheet}>
                <header className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Share with a researcher</p>
                        <h2 id="share-paper-title" className={styles.title}>
                            Share paper + annotations
                        </h2>
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Close share paper"
                    >
                        ×
                    </button>
                </header>

                <div className={styles.paperCard}>
                    <strong>{paper.title}</strong>
                    <span>
                        {highlightCount === null
                            ? "Checking annotations…"
                            : `${highlightCount} saved annotation${
                                  highlightCount === 1 ? "" : "s"
                              } included`}
                    </span>
                </div>

                <p className={styles.explainer}>
                    The recipient gets a read-only snapshot of this paper and
                    your current highlights. They must sign in to Expansive Mind
                    to open it.
                </p>

                {error ? (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                ) : null}

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={createAndShare}
                        disabled={sharing || highlightCount === null}
                    >
                        {sharing
                            ? "Preparing link…"
                            : share
                              ? "Share updated snapshot"
                              : "Share paper"}
                    </button>
                    {share ? (
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => void copyLink(share)}
                        >
                            {copied ? "Link copied" : "Copy link"}
                        </button>
                    ) : null}
                </div>

                <p className={styles.hint}>
                    Re-sharing refreshes the same private link with your latest
                    highlights.
                </p>
            </section>
        </div>,
        document.body,
    );
}
