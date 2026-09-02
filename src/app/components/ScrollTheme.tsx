"use client";

import { useEffect } from "react";

const HIDE_AFTER_MS = 1100;

export default function ScrollTheme() {
    useEffect(() => {
        const root = document.documentElement;
        let hideTimer = 0;

        const reveal = () => {
            root.classList.add("is-scrolling");
            window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(() => {
                root.classList.remove("is-scrolling");
            }, HIDE_AFTER_MS);
        };

        document.addEventListener("scroll", reveal, {
            capture: true,
            passive: true,
        });

        return () => {
            document.removeEventListener("scroll", reveal, true);
            window.clearTimeout(hideTimer);
            root.classList.remove("is-scrolling");
        };
    }, []);

    return null;
}
