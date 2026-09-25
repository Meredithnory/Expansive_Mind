/** A finger must move this far before a rail gesture locks to an axis. */
export const RAIL_AXIS_THRESHOLD_PX = 8;

/**
 * Vertical movement scrolls the page. Horizontal movement scrolls the rail.
 * A short wobble stays undecided so a tap can still activate a chip.
 */
export function railGestureAxis(
    dx: number,
    dy: number,
    threshold = RAIL_AXIS_THRESHOLD_PX,
): "x" | "y" | null {
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
    return Math.abs(dy) > Math.abs(dx) ? "y" : "x";
}

/**
 * A source rail is a horizontal scroller. On iOS that scrollport swallows a
 * vertical swipe that starts on it, so the page never moves. `touch-action:
 * pan-y` gives the vertical swipe to the page. This listener only takes over
 * when the gesture is horizontal, and a drag does not also activate a chip.
 */
export function attachHorizontalRail(viewport: HTMLElement) {
    let startX = 0;
    let startY = 0;
    let origin = 0;
    let axis: "x" | "y" | null = null;
    let moved = false;

    const start = (event: TouchEvent) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        origin = viewport.scrollLeft;
        axis = null;
        moved = false;
    };

    const move = (event: TouchEvent) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (!axis) {
            axis = railGestureAxis(dx, dy);
            if (!axis) return;
            moved = true;
        }
        if (axis === "y") return;
        if (event.cancelable) event.preventDefault();
        viewport.scrollLeft = origin - dx;
    };

    const click = (event: Event) => {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
    };

    viewport.addEventListener("touchstart", start, { passive: true });
    viewport.addEventListener("touchmove", move, { passive: false });
    viewport.addEventListener("click", click, true);

    return () => {
        viewport.removeEventListener("touchstart", start);
        viewport.removeEventListener("touchmove", move);
        viewport.removeEventListener("click", click, true);
    };
}
