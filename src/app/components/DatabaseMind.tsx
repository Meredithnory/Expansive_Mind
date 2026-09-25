"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { attachHorizontalRail } from "../lib/horizontal-rail";
import styles from "./styles/databasemind.module.scss";

export type SearchableMindSource =
    | "nih"
    | "springer"
    | "scholar"
    | "europe-pmc"
    | "crossref";
export type MindSource =
    | SearchableMindSource
    | "europe-pmc"
    | "crossref";

const SOURCES: {
    value: MindSource;
    name: string;
    detail: string;
    filterable: boolean;
    logo: string;
    logoStyle: "mark" | "wide" | "light";
}[] = [
    {
        value: "nih",
        name: "NIH PMC",
        detail: "PMC open access",
        filterable: true,
        logo: "/source-logos/nih-pmc.png",
        logoStyle: "mark",
    },
    {
        value: "springer",
        name: "Springer Nature",
        detail: "Open access publications",
        filterable: true,
        logo: "/source-logos/springer-nature.svg",
        logoStyle: "wide",
    },
    {
        value: "scholar",
        name: "Google Scholar",
        detail: "Ranked by relevance",
        filterable: true,
        logo: "/source-logos/google-scholar.svg",
        logoStyle: "mark",
    },
    {
        value: "europe-pmc",
        name: "Europe PMC",
        detail: "Discovery + PMC index",
        filterable: true,
        logo: "/source-logos/europe-pmc.png",
        logoStyle: "light",
    },
    {
        value: "crossref",
        name: "Crossref",
        detail: "DOI metadata index",
        filterable: true,
        logo: "/source-logos/crossref.svg",
        logoStyle: "light",
    },
];

const SOURCE_CLASS: Record<MindSource, string> = {
    nih: styles.nih,
    springer: styles.springer,
    scholar: styles.scholar,
    "europe-pmc": styles.europePmc,
    crossref: styles.crossref,
};

/* Orbit angles: where each database satellite rides the ring */
const ANGLE_CLASS: Record<MindSource, string> = {
    nih: styles.angleNih,
    springer: styles.angleSpringer,
    scholar: styles.angleScholar,
    "europe-pmc": styles.angleEuropePmc,
    crossref: styles.angleCrossref,
};

interface DatabaseMindProps {
    activeSource: "all" | SearchableMindSource;
    onSelect: (source: "all" | SearchableMindSource) => void;
}

const FOCUS_CLASS: Record<SearchableMindSource, string> = {
    nih: styles.focusNih,
    springer: styles.focusSpringer,
    scholar: styles.focusScholar,
    "europe-pmc": styles.focusEuropePmc,
    crossref: styles.focusCrossref,
};

function isSearchableSource(value: MindSource): value is SearchableMindSource {
    return (
        value === "nih" ||
        value === "springer" ||
        value === "scholar" ||
        value === "europe-pmc" ||
        value === "crossref"
    );
}

const COPIES = 3;
const LOOP = Array.from({ length: COPIES }, (_, copy) =>
    SOURCES.map((source) => ({ ...source, copy })),
).flat();

function loopWidth(viewport: HTMLElement) {
    return viewport.scrollWidth / COPIES;
}

function normalizeLoop(viewport: HTMLElement) {
    const width = loopWidth(viewport);
    if (width <= 0) return;
    if (viewport.scrollLeft < width * 0.5) {
        viewport.scrollLeft += width;
    } else if (viewport.scrollLeft >= width * 1.5) {
        viewport.scrollLeft -= width;
    }
}

const DatabaseMind = ({ activeSource, onSelect }: DatabaseMindProps) => {
    const hasFocus = activeSource !== "all";
    const viewportRef = useRef<HTMLDivElement>(null);
    const hoveringRef = useRef(false);
    const holdingRef = useRef(false);
    const [paused, setPaused] = useState(false);

    const syncPaused = () => {
        setPaused(hoveringRef.current || holdingRef.current);
    };
    const [activeValue, setActiveValue] = useState<string>(SOURCES[0].value);

    const syncActiveSource = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        normalizeLoop(viewport);
        const center = viewport.scrollLeft + viewport.clientWidth / 2;
        const cards = Array.from(
            viewport.querySelectorAll<HTMLElement>(`.${styles.chip}`),
        );
        let closestValue: string = SOURCES[0].value;
        let closestDistance = Number.POSITIVE_INFINITY;
        cards.forEach((card) => {
            const distance = Math.abs(
                center - (card.offsetLeft + card.offsetWidth / 2),
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closestValue = card.dataset.value ?? closestValue;
            }
        });
        setActiveValue(closestValue);
    }, []);

    const move = (direction: 1 | -1) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const card = viewport.querySelector<HTMLElement>(`.${styles.chip}`);
        const step = (card?.offsetWidth ?? 198) + 10;
        viewport.scrollBy({ left: direction * step, behavior: "smooth" });
    };

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        return attachHorizontalRail(viewport);
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const place = () => {
            if (viewport.scrollLeft === 0) {
                viewport.scrollLeft = loopWidth(viewport);
            } else {
                normalizeLoop(viewport);
            }
        };

        place();
        const observer = new ResizeObserver(place);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const release = () => {
            if (!holdingRef.current) return;
            holdingRef.current = false;
            syncPaused();
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        return () => {
            window.removeEventListener("pointerup", release);
            window.removeEventListener("pointercancel", release);
        };
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (
            !viewport ||
            paused ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return;
        }

        let frame = 0;
        const tick = () => {
            viewport.scrollLeft += 0.55;
            normalizeLoop(viewport);
            frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [paused]);

    return (
        <div
            className={clsx(
                styles.panel,
                hasFocus && styles.panelFocused,
                hasFocus && FOCUS_CLASS[activeSource as SearchableMindSource],
            )}
        >
            <div
                className={styles.carousel}
                role="region"
                aria-label="Research databases"
                onMouseEnter={() => {
                    hoveringRef.current = true;
                    syncPaused();
                }}
                onMouseLeave={() => {
                    hoveringRef.current = false;
                    syncPaused();
                }}
                onFocusCapture={() => {
                    hoveringRef.current = true;
                    syncPaused();
                }}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        hoveringRef.current = false;
                        syncPaused();
                    }
                }}
            >
                <button
                    type="button"
                    className={clsx(styles.arrow, styles.arrowPrevious)}
                    onClick={() => move(-1)}
                    aria-label="Previous research databases"
                >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m10 3-5 5 5 5" />
                    </svg>
                </button>
                <div
                    ref={viewportRef}
                    className={styles.chips}
                    data-paused={paused}
                    onPointerDown={() => {
                        holdingRef.current = true;
                        syncPaused();
                    }}
                    onScroll={syncActiveSource}
                >
                    <div className={styles.chipTrack}>
                        {LOOP.map((source, index) => {
                            const isSelected = activeSource === source.value;
                            const isCarouselActive = activeValue === source.value;
                            const content = (
                                <>
                                    <span
                                        className={clsx(
                                            styles.logoFrame,
                                            source.logoStyle === "light" &&
                                                styles.logoFrameLight,
                                        )}
                                    >
                                        <Image
                                            className={clsx(
                                                styles.sourceLogo,
                                                source.logoStyle !== "mark" &&
                                                    styles.sourceLogoWide,
                                            )}
                                            src={source.logo}
                                            alt=""
                                            width={74}
                                            height={30}
                                        />
                                    </span>
                                    <span className={styles.chipText}>
                                        <span className={styles.chipName}>
                                            {source.name}
                                        </span>
                                        <span className={styles.chipDetail}>
                                            {source.detail}
                                        </span>
                                    </span>
                                </>
                            );

                            return source.filterable ? (
                                <button
                                    key={`${source.copy}-${source.value}-${index}`}
                                    type="button"
                                    className={clsx(
                                        styles.chip,
                                        SOURCE_CLASS[source.value],
                                        isSelected && styles.chipActive,
                                        isCarouselActive &&
                                            styles.chipCarouselActive,
                                    )}
                                    data-value={source.value}
                                    onClick={() => {
                                        if (!isSearchableSource(source.value)) return;
                                        onSelect(
                                            activeSource === source.value
                                                ? "all"
                                                : source.value,
                                        );
                                    }}
                                    aria-pressed={isSelected}
                                    aria-hidden={source.copy !== 1}
                                >
                                    {content}
                                </button>
                            ) : (
                                <div
                                    key={`${source.copy}-${source.value}-${index}`}
                                    className={clsx(
                                        styles.chip,
                                        styles.indexChip,
                                        SOURCE_CLASS[source.value],
                                        isCarouselActive &&
                                            styles.chipCarouselActive,
                                    )}
                                    data-value={source.value}
                                    title="Used in multi-database Discover synthesis"
                                    aria-hidden={source.copy !== 1}
                                >
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <button
                    type="button"
                    className={clsx(styles.arrow, styles.arrowNext)}
                    onClick={() => move(1)}
                    aria-label="Next research databases"
                >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m6 3 5 5-5 5" />
                    </svg>
                </button>
            </div>

            <div className={styles.scene} aria-hidden>
                <span className={styles.ringOuter} />
                <span className={styles.ringInner} />

                <span className={styles.orbit}>
                    {SOURCES.map((source) => (
                        <span
                            key={source.value}
                            className={clsx(
                                styles.satelliteArm,
                                SOURCE_CLASS[source.value],
                                ANGLE_CLASS[source.value],
                            )}
                        >
                            <span className={styles.satellite} />
                        </span>
                    ))}
                </span>

                {SOURCES.map((source) => (
                    <span
                        key={source.value}
                        className={clsx(
                            styles.absorbArm,
                            SOURCE_CLASS[source.value],
                            ANGLE_CLASS[source.value],
                        )}
                    >
                        <span className={styles.absorbDot} />
                    </span>
                ))}

                <span className={styles.headGlow} />
                <div className={styles.headFloat}>
                    <Image
                        className={styles.head}
                        src="/brainlogo.svg"
                        alt=""
                        width={170}
                        height={170}
                    />
                </div>
                <span className={styles.headShadow} />
            </div>
        </div>
    );
};

export default DatabaseMind;
