"use client";

import { useEffect } from "react";
import {
    focusedFieldScrollDelta,
    headingNeedsPin,
    resolveKeyboardChrome,
} from "../lib/keyboard-inset";

const FIELD_SELECTOR = "input, textarea, select, [contenteditable='true']";
const PHONE_QUERY = "(max-width: 720px)";

type VirtualKeyboardHandle = {
    overlaysContent: boolean;
    boundingRect: DOMRect;
    addEventListener: (type: "geometrychange", listener: () => void) => void;
    removeEventListener: (type: "geometrychange", listener: () => void) => void;
};

type LockedScroll = {
    x: number;
    y: number;
    nodes: Array<{ el: HTMLElement; top: number }>;
};

function virtualKeyboard(): VirtualKeyboardHandle | null {
    const keyboard = (
        navigator as Navigator & { virtualKeyboard?: VirtualKeyboardHandle }
    ).virtualKeyboard;
    return keyboard ?? null;
}

function pageHeading(): HTMLElement | null {
    const headings = document.querySelectorAll(".main-content h1");
    for (const node of headings) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.closest("[data-app-nav]")) continue;
        if (node.className.includes("srOnly")) continue;
        const rect = node.getBoundingClientRect();
        if (rect.height < 8 || rect.width < 8) continue;
        return node;
    }
    return null;
}

function clearPinnedHeadings() {
    document.querySelectorAll("[data-keyboard-pin]").forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.style.position = "";
        node.style.top = "";
        node.style.left = "";
        node.style.width = "";
        node.style.zIndex = "";
        node.style.background = "";
        node.style.margin = "";
        node.removeAttribute("data-keyboard-pin");
    });
    document
        .querySelectorAll("[data-keyboard-pin-spacer]")
        .forEach((node) => node.remove());
}

function pinHeading(heading: HTMLElement) {
    if (heading.hasAttribute("data-keyboard-pin")) return;
    const rect = heading.getBoundingClientRect();
    const spacer = document.createElement("div");
    spacer.setAttribute("data-keyboard-pin-spacer", "");
    spacer.style.height = `${rect.height}px`;
    heading.after(spacer);
    heading.setAttribute("data-keyboard-pin", "");
    heading.style.position = "fixed";
    heading.style.top = "12px";
    heading.style.left = `${Math.max(16, rect.left)}px`;
    heading.style.width = `${rect.width}px`;
    heading.style.zIndex = "6";
    heading.style.background = "#000";
    heading.style.margin = "0";
}

function isField(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement && target.matches(FIELD_SELECTOR);
}

function scrollableAncestors(node: HTMLElement): HTMLElement[] {
    const list: HTMLElement[] = [];
    let parent = node.parentElement;
    while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
    ) {
        const overflow = getComputedStyle(parent).overflowY;
        if (
            (overflow === "auto" || overflow === "scroll") &&
            parent.scrollHeight > parent.clientHeight + 1
        ) {
            list.push(parent);
        }
        parent = parent.parentElement;
    }
    return list;
}

function snapshotScroll(field: HTMLElement): LockedScroll {
    return {
        x: window.scrollX,
        y: window.scrollY,
        nodes: scrollableAncestors(field).map((el) => ({
            el,
            top: el.scrollTop,
        })),
    };
}

export default function KeyboardInset() {
    useEffect(() => {
        const root = document.documentElement;
        const viewport = window.visualViewport;
        const keyboard = virtualKeyboard();
        let stableHeight = window.innerHeight;
        let frame = 0;
        let locked: LockedScroll | null = null;
        let correcting = false;
        let focused: HTMLElement | null = null;

        try {
            if (keyboard) keyboard.overlaysContent = true;
        } catch {
            /* Some browsers expose the API but reject the overlay flag. */
        }

        const apply = () => {
            const layoutHeight = window.innerHeight;
            const visualHeight = viewport?.height ?? layoutHeight;
            const offsetTop = viewport?.offsetTop ?? 0;
            const chrome = resolveKeyboardChrome(
                layoutHeight,
                visualHeight,
                offsetTop,
                stableHeight,
                keyboard?.boundingRect.height ?? 0,
            );
            stableHeight = chrome.stableHeight;
            root.style.setProperty("--keyboard-inset", `${chrome.inset}px`);
            root.style.setProperty("--vv-offset-top", `${chrome.offsetTop}px`);
            root.style.setProperty(
                "--stable-viewport-height",
                `${chrome.stableHeight}px`,
            );
            root.toggleAttribute("data-keyboard-open", chrome.open);
            root.toggleAttribute(
                "data-vv-pan",
                chrome.open && chrome.offsetTop > 0,
            );
        };

        const schedule = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                apply();
                nudgeFocused();
            });
        };

        const restoreLockedScroll = () => {
            if (!locked || correcting) return;
            const drifted =
                window.scrollX !== locked.x ||
                window.scrollY !== locked.y ||
                locked.nodes.some((node) => node.el.scrollTop !== node.top);
            if (!drifted) return;
            correcting = true;
            window.scrollTo(locked.x, locked.y);
            for (const node of locked.nodes) node.el.scrollTop = node.top;
            correcting = false;
        };

        const nudgeField = (field: HTMLElement) => {
            apply();
            const nav = document.querySelector("[data-app-nav]");
            const bandBottom =
                nav instanceof HTMLElement
                    ? nav.getBoundingClientRect().top - 12
                    : (viewport?.height ?? window.innerHeight);
            const rect = field.getBoundingClientRect();
            const delta = focusedFieldScrollDelta(
                rect.top,
                rect.bottom,
                8,
                bandBottom,
            );
            if (delta <= 1) return;
            const heading = pageHeading();
            if (
                heading &&
                headingNeedsPin(heading.getBoundingClientRect().top, delta)
            ) {
                pinHeading(heading);
            }
            const nextRect = field.getBoundingClientRect();
            const nextDelta = focusedFieldScrollDelta(
                nextRect.top,
                nextRect.bottom,
                8,
                bandBottom,
            );
            if (nextDelta <= 1) return;
            const scroller = scrollableAncestors(field)[0];
            const before = scroller ? scroller.scrollTop : window.scrollY;
            correcting = true;
            if (scroller) scroller.scrollTop += nextDelta;
            else window.scrollBy(0, nextDelta);
            const after = scroller ? scroller.scrollTop : window.scrollY;
            locked = snapshotScroll(field);
            correcting = false;
            if (after === before) return;
        };

        function nudgeFocused() {
            if (!focused || !focused.isConnected) return;
            if (document.activeElement !== focused) return;
            if (!window.matchMedia(PHONE_QUERY).matches) return;
            nudgeField(focused);
        }

        const onFocusIn = (event: FocusEvent) => {
            if (!isField(event.target)) return;
            if (!window.matchMedia(PHONE_QUERY).matches) return;
            focused = event.target;
            locked = snapshotScroll(event.target);
            const field = event.target;
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    if (focused !== field || !field.isConnected) return;
                    restoreLockedScroll();
                    nudgeField(field);
                });
            });
        };

        const onFocusOut = (event: FocusEvent) => {
            if (!isField(event.target)) return;
            if (focused === event.target) focused = null;
            locked = null;
            clearPinnedHeadings();
            schedule();
        };

        const onViewportScroll = () => {
            restoreLockedScroll();
            schedule();
        };

        apply();
        viewport?.addEventListener("resize", schedule);
        viewport?.addEventListener("scroll", onViewportScroll);
        window.addEventListener("resize", schedule);
        document.addEventListener("focusin", onFocusIn, true);
        document.addEventListener("focusout", onFocusOut, true);
        keyboard?.addEventListener("geometrychange", schedule);

        return () => {
            window.cancelAnimationFrame(frame);
            viewport?.removeEventListener("resize", schedule);
            viewport?.removeEventListener("scroll", onViewportScroll);
            window.removeEventListener("resize", schedule);
            document.removeEventListener("focusin", onFocusIn, true);
            document.removeEventListener("focusout", onFocusOut, true);
            keyboard?.removeEventListener("geometrychange", schedule);
            root.style.removeProperty("--keyboard-inset");
            root.style.removeProperty("--vv-offset-top");
            root.style.removeProperty("--stable-viewport-height");
            root.removeAttribute("data-keyboard-open");
            root.removeAttribute("data-vv-pan");
            clearPinnedHeadings();
        };
    }, []);

    return null;
}
