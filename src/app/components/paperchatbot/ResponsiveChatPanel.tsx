"use client";

import React, { useEffect, useRef, useState } from "react";
import Chatbox from "./Chatbox";
import styles from "../styles/mobilechatsheet.module.scss";

type ResponsiveChatPanelProps = React.ComponentProps<typeof Chatbox> & {
    activeTool?: "highlight" | null;
};

const DRAG_THRESHOLD = 56;

const ResponsiveChatPanel = ({
    activeTool,
    ...chatboxProps
}: ResponsiveChatPanelProps) => {
    const [expanded, setExpanded] = useState(false);
    // Phones: after "Show in paper" closes the sheet, offer the way back.
    const [showingCite, setShowingCite] = useState(false);
    const panelRef = useRef<HTMLElement>(null);
    const dragStartY = useRef(0);
    const dragStartedExpanded = useRef(false);
    const didDrag = useRef(false);
    const pendingDragOffset = useRef(0);
    const dragFrame = useRef<number | null>(null);

    const paintDragOffset = () => {
        dragFrame.current = null;
        panelRef.current?.style.setProperty(
            "--sheet-drag-offset",
            `${pendingDragOffset.current}px`,
        );
    };

    useEffect(() => {
        if (!expanded) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setExpanded(false);
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [expanded]);

    useEffect(() => {
        if (
            chatboxProps.figureRequest ||
            chatboxProps.pendingAttachment ||
            chatboxProps.pendingInsert
        ) {
            setExpanded(true);
        }
    }, [
        chatboxProps.figureRequest,
        chatboxProps.pendingAttachment,
        chatboxProps.pendingInsert,
    ]);

    useEffect(() => {
        if (activeTool) setExpanded(false);
    }, [activeTool]);

    // "Your highlights" (Contents menu, highlight sheet) opens the sheet on
    // its Highlights tab; on a phone a tab switch alone stays out of sight.
    const showHighlightsRequest = chatboxProps.showHighlightsRequest ?? 0;
    useEffect(() => {
        if (showHighlightsRequest > 0) setExpanded(true);
    }, [showHighlightsRequest]);

    useEffect(() => {
        if (expanded) setShowingCite(false);
    }, [expanded]);

    useEffect(() => {
        if (!showingCite) return;
        const timer = window.setTimeout(() => setShowingCite(false), 8000);
        return () => window.clearTimeout(timer);
    }, [showingCite]);

    useEffect(
        () => () => {
            if (dragFrame.current !== null) {
                window.cancelAnimationFrame(dragFrame.current);
            }
        },
        [],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        dragStartY.current = event.clientY;
        dragStartedExpanded.current = expanded;
        didDrag.current = false;
        panelRef.current?.classList.add(styles.dragging);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

        const delta = event.clientY - dragStartY.current;
        if (Math.abs(delta) > 4) {
            didDrag.current = true;
        }
        pendingDragOffset.current = dragStartedExpanded.current
            ? Math.max(0, delta)
            : Math.min(0, delta);
        if (dragFrame.current === null) {
            dragFrame.current = window.requestAnimationFrame(paintDragOffset);
        }
    };

    const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        const finalOffset = event.clientY - dragStartY.current;
        if (
            dragStartedExpanded.current &&
            finalOffset > DRAG_THRESHOLD
        ) {
            setExpanded(false);
        } else if (
            !dragStartedExpanded.current &&
            finalOffset < -DRAG_THRESHOLD
        ) {
            setExpanded(true);
        }
        pendingDragOffset.current = 0;
        if (dragFrame.current !== null) {
            window.cancelAnimationFrame(dragFrame.current);
            dragFrame.current = null;
        }
        panelRef.current?.style.setProperty("--sheet-drag-offset", "0px");
        panelRef.current?.classList.remove(styles.dragging);
    };

    const handleToggle = () => {
        if (didDrag.current) {
            didDrag.current = false;
            return;
        }
        setExpanded((current) => !current);
    };

    return (
        <section
            ref={panelRef}
            className={`${styles.panel} ${expanded ? styles.expanded : ""} ${
                activeTool ? styles.toolActive : ""
            }`}
            style={{ "--sheet-drag-offset": "0px" } as React.CSSProperties}
            aria-label="Paper chat"
        >
            {showingCite && !expanded && (
                <div className={styles.citeNote} role="status">
                    Showing the cited passage
                    <button type="button" onClick={() => setExpanded(true)}>
                        Back to chat
                    </button>
                </div>
            )}
            <button
                type="button"
                className={styles.handle}
                aria-label={expanded ? "Collapse paper chat" : "Ask about this paper"}
                aria-expanded={expanded}
                onClick={handleToggle}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
            >
                <span className={styles.grabber} aria-hidden="true" />
                <span className={styles.handleLabel}>
                    Ask about this paper…
                </span>
                <span className={styles.handleArrow} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </button>
            <div className={styles.content}>
                <Chatbox
                    {...chatboxProps}
                    onSubmitStart={() => setExpanded(true)}
                    onClose={expanded ? () => setExpanded(false) : undefined}
                    onLocateCitation={(citation) => {
                        if (expanded) setShowingCite(true);
                        setExpanded(false);
                        chatboxProps.onLocateCitation?.(citation);
                    }}
                />
            </div>
        </section>
    );
};

export default ResponsiveChatPanel;
