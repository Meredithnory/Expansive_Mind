"use client";

import { useEffect } from "react";
import {
    commitNavDirection,
    installNavDirectionListeners,
} from "./lib/nav-direction";

/**
 * Root template: remounts on every route change so the enter animation
 * replays. The navigation listener briefly marks the document with the travel
 * direction so globals.scss can choose the corresponding enter animation.
 */
export default function Template({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    useEffect(() => {
        installNavDirectionListeners();
        commitNavDirection();
    }, []);

    return <div className="page-transition-shell">{children}</div>;
}
