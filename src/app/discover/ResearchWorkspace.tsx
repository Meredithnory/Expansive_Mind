"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ResearchModeToggle from "../components/ResearchModeToggle";
import DiscoverClient from "./DiscoverClient";
import SearchPaperClient from "../searchpaper/SearchPaperClient";
import workspaceStyles from "./research-workspace.module.scss";
import {
    buildResearchModeUrl,
    parseResearchMode,
    type ResearchMode,
} from "../lib/research-mode";

type ResearchWorkspaceProps = {
    modeParam: string;
    qParam: string;
    savedParam: string;
    pageParam: string;
    sourceParam: string;
    dateParam: string;
};

function firstParam(
    searchParams: URLSearchParams,
    key: string,
    fallback: string,
) {
    return searchParams.get(key) ?? fallback;
}

function readScrollY() {
    return window.scrollY || document.documentElement.scrollTop || 0;
}

function restoreScrollY(y: number) {
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
    const main = document.querySelector(".main-content");
    if (main instanceof HTMLElement) main.scrollTop = y;
}

export default function ResearchWorkspace({
    modeParam,
    qParam,
    savedParam,
    pageParam,
    sourceParam,
    dateParam,
}: ResearchWorkspaceProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pendingScrollY = useRef<number | null>(null);

    // Prefer live URL params so the Discovery | Search toggle updates immediately.
    const mode = parseResearchMode(
        searchParams.get("mode") ?? modeParam,
    );
    const liveQ = firstParam(searchParams, "q", qParam);
    const liveSaved = firstParam(searchParams, "saved", savedParam);
    const livePage = firstParam(searchParams, "page", pageParam);
    const liveSource = firstParam(searchParams, "source", sourceParam);
    const liveDate = firstParam(searchParams, "date", dateParam);

    const setMode = useCallback(
        (next: ResearchMode) => {
            if (next === mode) return;
            pendingScrollY.current = readScrollY();
            router.replace(buildResearchModeUrl(next, searchParams), {
                scroll: false,
            });
        },
        [mode, router, searchParams],
    );

    useLayoutEffect(() => {
        if (pendingScrollY.current == null) return;
        const y = pendingScrollY.current;
        pendingScrollY.current = null;
        restoreScrollY(y);
        // One more frame in case a child mount still tries to reset scroll.
        window.requestAnimationFrame(() => restoreScrollY(y));
    }, [mode]);

    return (
        <div
            className={workspaceStyles.shell}
            data-research-workspace
        >
            <div className={workspaceStyles.chromeSlot}>
                <ResearchModeToggle mode={mode} onChange={setMode} />
            </div>
            <div className={workspaceStyles.modePane}>
                {mode === "search" ? (
                    <SearchPaperClient
                        initialQuery={liveQ}
                        initialPage={livePage}
                        initialSource={liveSource}
                        initialDate={liveDate}
                        skipInitialScroll
                        landingIntro={null}
                    />
                ) : (
                    <DiscoverClient
                        qParam={liveQ}
                        savedParam={liveSaved}
                    />
                )}
            </div>
        </div>
    );
}
