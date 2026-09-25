/** iOS updates the selection after touchend. Wait for it to settle. */
export const TOUCH_HIGHLIGHT_SETTLE_MS = 450;

/**
 * iOS sends a mouseup right after touchend. That mouseup sees a selection
 * that is still being adjusted and would clear it.
 */
export const SYNTHETIC_MOUSE_WINDOW_MS = 800;

export function isSyntheticMouseAfterTouch(
    touchEndedAt: number | null,
    now: number,
) {
    return (
        touchEndedAt != null &&
        now - touchEndedAt >= 0 &&
        now - touchEndedAt < SYNTHETIC_MOUSE_WINDOW_MS
    );
}

export function highlightCommitDelay(pointer: "mouse" | "touch") {
    return pointer === "touch" ? TOUCH_HIGHLIGHT_SETTLE_MS : 0;
}
