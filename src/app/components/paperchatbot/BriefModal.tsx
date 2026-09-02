"use client";
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import styles from "../styles/briefmodal.module.scss";
import type { FormattedPaper } from "../../api/general-interfaces";
import { useSession } from "../../lib/use-session";

interface BriefData {
    brief: string;
    slug: string;
    updatedAt?: string;
}

interface BriefModalProps {
    paper: FormattedPaper;
    open: boolean;
    onClose: () => void;
}

const shareUrlFor = (slug: string) =>
    `${window.location.origin}/brief/${slug}`;

const BriefModal = ({ paper, open, onClose }: BriefModalProps) => {
    const { refresh } = useSession();
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [checked, setChecked] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState<"link" | "markdown" | null>(null);

    const paperRef = {
        database: paper.source || "",
        paperId: paper.paperId,
        idName: paper.idName,
    };

    const fetchExisting = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                database: paper.source || "",
                paperId: paper.paperId,
                idName: paper.idName,
            });
            const res = await fetch(`/api/brief?${params}`);
            const data = await res.json();
            if (res.ok) {
                setBrief(data.brief || null);
            }
        } catch {
            // Lookup failures are non-fatal; the user can still generate.
        } finally {
            setChecked(true);
        }
    }, [paper.source, paper.paperId, paper.idName]);

    useEffect(() => {
        if (open && !checked) {
            void fetchExisting();
        }
    }, [open, checked, fetchExisting]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKey);
        };
    }, [open, onClose]);

    const generate = async () => {
        setGenerating(true);
        setError("");
        try {
            const res = await fetch("/api/brief", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(paperRef),
            });
            const data = await res.json();
            void refresh();
            if (!res.ok || !data.brief) {
                throw new Error(
                    data.error || "The paper summary could not be generated.",
                );
            }
            setBrief(data.brief);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "The paper summary could not be generated.",
            );
        } finally {
            setGenerating(false);
        }
    };

    const copy = async (kind: "link" | "markdown") => {
        if (!brief) return;
        const text =
            kind === "link"
                ? shareUrlFor(brief.slug)
                : `# ${paper.title}\n\n${brief.brief}\n\nRead more: ${shareUrlFor(brief.slug)}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(kind);
            window.setTimeout(() => setCopied(null), 2_000);
        } catch {
            setError("Could not copy to the clipboard.");
        }
    };

    const shareOnX = () => {
        if (!brief) return;
        const url = new URL("https://twitter.com/intent/tweet");
        url.searchParams.set(
            "text",
            `Paper summary: ${paper.title}`.slice(0, 200),
        );
        url.searchParams.set("url", shareUrlFor(brief.slug));
        window.open(url.toString(), "_blank", "noopener,noreferrer");
    };

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-label="Paper summary"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className={styles.modal}>
                <header className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Paper Summary</p>
                        <h2 className={styles.title}>{paper.title}</h2>
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Close paper summary"
                    >
                        ×
                    </button>
                </header>

                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                {brief ? (
                    <>
                        <div className={styles.briefBody}>
                            <ReactMarkdown>{brief.brief}</ReactMarkdown>
                        </div>
                        <footer className={styles.actions}>
                            <button
                                type="button"
                                className={styles.primaryAction}
                                onClick={() => copy("link")}
                            >
                                {copied === "link"
                                    ? "Link copied!"
                                    : "Copy share link"}
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryAction}
                                onClick={shareOnX}
                            >
                                Post on X
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryAction}
                                onClick={() => copy("markdown")}
                            >
                                {copied === "markdown"
                                    ? "Copied!"
                                    : "Copy as markdown"}
                            </button>
                            <button
                                type="button"
                                className={styles.tertiaryAction}
                                onClick={generate}
                                disabled={generating}
                            >
                                {generating
                                    ? "Regenerating…"
                                    : "Regenerate"}
                            </button>
                        </footer>
                        <p className={styles.hint}>
                            Anyone with the link can read this summary — no
                            account needed. Regenerating uses one AI question.
                        </p>
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <p>
                            Distill this paper into a short, shareable summary:
                            a plain-language TL;DR, key findings with
                            citations, why it matters, and limitations.
                        </p>
                        <button
                            type="button"
                            className={styles.primaryAction}
                            onClick={generate}
                            disabled={generating || !checked}
                        >
                            {generating
                                ? "Generating…"
                                : "Generate summary"}
                        </button>
                        <p className={styles.hint}>
                            Uses one AI question from your plan.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default BriefModal;
