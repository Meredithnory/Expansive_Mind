"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./discover.module.scss";

type ShareState =
    | { status: "loading" }
    | { status: "ready"; url: string }
    | { status: "error"; message: string };

/**
 * "Share your brief": makes the public link for a saved discovery and shows
 * what a reader will and won't see.
 */
export default function ShareBriefDialog({
    discoveryId,
    onClose,
    onShared,
}: {
    discoveryId: string;
    onClose: () => void;
    /** Called once the public link exists (the Library marks it shared). */
    onShared?: () => void;
}) {
    const [share, setShare] = useState<ShareState>({ status: "loading" });
    const [copied, setCopied] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const onSharedRef = useRef(onShared);
    useEffect(() => {
        onSharedRef.current = onShared;
    }, [onShared]);

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch("/api/discover/share", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: discoveryId }),
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || typeof data.slug !== "string") {
                    throw new Error(
                        typeof data.error === "string"
                            ? data.error
                            : "Unable to share this brief.",
                    );
                }
                setShare({
                    status: "ready",
                    url: `${window.location.origin}/brief/${data.slug}`,
                });
                onSharedRef.current?.();
            } catch (error) {
                if (controller.signal.aborted) return;
                setShare({
                    status: "error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to share this brief.",
                });
            }
        })();
        return () => controller.abort();
    }, [discoveryId]);

    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 2_500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const copyLink = async () => {
        if (share.status !== "ready") return;
        try {
            await navigator.clipboard.writeText(share.url);
            setCopied(true);
        } catch {
            // The link stays visible to copy by hand.
        }
    };

    return createPortal(
        <div
            className={styles.shareOverlay}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className={styles.shareDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-brief-title"
                aria-describedby="share-brief-lead"
            >
                <span className={styles.shareGrabber} aria-hidden="true" />
                <div className={styles.shareHead}>
                    <div>
                        <h2 id="share-brief-title" className={styles.shareTitle}>
                            Share your brief
                        </h2>
                        <p id="share-brief-lead" className={styles.shareLead}>
                            Anyone with the link can read it. No account needed.
                        </p>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        className={styles.shareClose}
                        aria-label="Close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className={styles.shareLinkRow}>
                    <span className={styles.shareLink}>
                        {share.status === "ready"
                            ? share.url.replace(/^https?:\/\//, "")
                            : share.status === "loading"
                              ? "Making your link…"
                              : share.message}
                    </span>
                    <button
                        type="button"
                        className={copied ? styles.shareCopied : styles.shareCopy}
                        onClick={() => void copyLink()}
                        disabled={share.status !== "ready"}
                    >
                        {copied ? "Link copied!" : "Copy link"}
                    </button>
                </div>

                <div className={styles.shareScope}>
                    <div className={styles.shareScopeCard}>
                        <span className={styles.shareScopeTitle} data-tone="green">
                            People will see
                        </span>
                        <span>
                            Your question · the cited brief · the claim ledger ·
                            the papers behind it
                        </span>
                    </div>
                    <div className={styles.shareScopeCard}>
                        <span className={styles.shareScopeTitle}>Stays private</span>
                        <span>
                            Your paper chats · your highlights and notes ·
                            your projects
                        </span>
                    </div>
                </div>
            </section>
        </div>,
        document.body,
    );
}
