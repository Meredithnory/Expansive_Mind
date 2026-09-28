// Scroll a focused passage into view by its own position, not its paragraph's:
// centering a long paragraph pushes a passage at its start above the fold.

/** Where the passage's first line lands, as a fraction of the visible height. */
export const PASSAGE_VIEW_FRACTION = 0.25;

/** Pixels to scroll so a passage at `rangeTop` sits at the reading line of the viewport. */
export function passageScrollDelta(
    rangeTop: number,
    viewportTop: number,
    viewportHeight: number,
    fraction = PASSAGE_VIEW_FRACTION,
): number {
    return Math.round(rangeTop - viewportTop - viewportHeight * fraction);
}

function scrollableAncestor(node: Node | null): HTMLElement | null {
    let element = node instanceof Element ? node : node?.parentElement ?? null;
    while (element && element !== document.body) {
        const { overflowY } = getComputedStyle(element);
        if (
            (overflowY === "auto" || overflowY === "scroll") &&
            element.scrollHeight > element.clientHeight
        ) {
            return element as HTMLElement;
        }
        element = element.parentElement;
    }
    return null;
}

export function scrollRangeIntoView(range: Range) {
    const rect = range.getBoundingClientRect();
    const container = scrollableAncestor(range.startContainer);
    if (container) {
        const box = container.getBoundingClientRect();
        container.scrollBy({
            top: passageScrollDelta(rect.top, box.top, box.height),
            behavior: "smooth",
        });
        return;
    }
    window.scrollBy({
        top: passageScrollDelta(rect.top, 0, window.innerHeight),
        behavior: "smooth",
    });
}
