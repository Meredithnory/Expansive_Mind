/** Ignore URL-bar wobble. A phone keyboard covers far more than this. */
export const KEYBOARD_OPEN_MIN_PX = 80;

export function keyboardInsetFromViewport(
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

export type KeyboardChrome = {
    inset: number;
    offsetTop: number;
    open: boolean;
    stableHeight: number;
};

function positive(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Keyboard chrome for fixed bars.
 * `inset` is how far the keyboard covers the bottom of the layout viewport.
 * `offsetTop` is a visual-viewport pan (the page sliding up) and is not
 * added on top of the inset. While the keyboard is open, `stableHeight`
 * stays at the pre-keyboard layout height so `100dvh` cannot shrink the shell.
 */
export function resolveKeyboardChrome(
    layoutHeight: number,
    visualHeight: number,
    visualOffsetTop: number,
    stableHeight: number,
    virtualKeyboardHeight = 0,
): KeyboardChrome {
    const fromViewport = keyboardInsetFromViewport(
        layoutHeight,
        visualHeight,
        visualOffsetTop,
    );
    const fromKeyboard = positive(virtualKeyboardHeight);
    const inset = Math.max(fromViewport, fromKeyboard);
    const offsetTop = Number.isFinite(visualOffsetTop)
        ? Math.max(0, visualOffsetTop)
        : 0;
    const open = inset >= KEYBOARD_OPEN_MIN_PX;
    const nextStable = open
        ? positive(stableHeight) || positive(layoutHeight)
        : positive(layoutHeight) || positive(stableHeight);
    return {
        inset,
        offsetTop,
        open,
        stableHeight: nextStable,
    };
}

/** Pixels to add to the nearest scroll offset so the field stays in band. */
export function focusedFieldScrollDelta(
    fieldTop: number,
    fieldBottom: number,
    bandTop: number,
    bandBottom: number,
): number {
    if (
        !Number.isFinite(fieldTop) ||
        !Number.isFinite(fieldBottom) ||
        !Number.isFinite(bandTop) ||
        !Number.isFinite(bandBottom)
    ) {
        return 0;
    }
    const overflowBelow = fieldBottom - bandBottom;
    if (overflowBelow > 1) return overflowBelow;
    const overflowAbove = bandTop - fieldTop;
    if (overflowAbove > 1) return -overflowAbove;
    return 0;
}
