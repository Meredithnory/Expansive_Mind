"use client";

import { useEffect } from "react";
import {
    focusedFieldScrollDelta,
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
            frame = window.requestAnimationFrame(apply);
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
            if (Math.abs(delta) <= 1) return;
            const scroller = scrollableAncestors(field)[0];
            if (scroller) scroller.scrollTop += delta;
            else window.scrollBy(0, delta);
            locked = snapshotScroll(field);
        };

        const onFocusIn = (event: FocusEvent) => {
            if (!isField(event.target)) return;
            if (!window.matchMedia(PHONE_QUERY).matches) return;
            locked = snapshotScroll(event.target);
            const field = event.target;
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    if (!locked || !field.isConnected) return;
                    restoreLockedScroll();
                    nudgeField(field);
                });
            });
        };

        const onFocusOut = (event: FocusEvent) => {
            if (!isField(event.target)) return;
            locked = null;
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
        };
    }, []);

    return null;
}
