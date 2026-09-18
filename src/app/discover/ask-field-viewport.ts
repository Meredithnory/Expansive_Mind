export function discoverAskKeyboardInset(
    layoutHeight: number,
    visualHeight: number,
    visualOffsetTop: number,
): number {
    if (
        !Number.isFinite(layoutHeight) ||
        !Number.isFinite(visualHeight) ||
        !Number.isFinite(visualOffsetTop)
    ) {
        return 0;
    }
    return Math.max(
        0,
        layoutHeight - visualHeight - Math.max(0, visualOffsetTop),
    );
}
