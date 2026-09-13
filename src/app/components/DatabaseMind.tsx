"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import styles from "./styles/databasemind.module.scss";

export type SearchableMindSource = "nih" | "springer" | "scholar";
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
        filterable: false,
        logo: "/source-logos/europe-pmc.png",
        logoStyle: "light",
    },
    {
        value: "crossref",
        name: "Crossref",
        detail: "DOI metadata index",
        filterable: false,
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
    onSelect: (source: SearchableMindSource) => void;
}

const FOCUS_CLASS: Record<SearchableMindSource, string> = {
    nih: styles.focusNih,
    springer: styles.focusSpringer,
    scholar: styles.focusScholar,
};

const DatabaseMind = ({ activeSource, onSelect }: DatabaseMindProps) => {
    const hasFocus = activeSource !== "all";
    const viewportRef = useRef<HTMLDivElement>(null);
    const [paused, setPaused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const goTo = useCallback((index: number) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const cards = viewport.querySelectorAll<HTMLElement>(`.${styles.chip}`);
        const normalized = (index + SOURCES.length) % SOURCES.length;
        const card = cards[normalized];
        if (!card) return;
        setActiveIndex(normalized);
        viewport.scrollTo({
            left:
                card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2,
            behavior: "smooth",
        });
    }, []);

    const syncActiveSource = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const center = viewport.scrollLeft + viewport.clientWidth / 2;
        const cards = Array.from(
            viewport.querySelectorAll<HTMLElement>(`.${styles.chip}`),
        );
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        cards.forEach((card, index) => {
            const distance = Math.abs(
                center - (card.offsetLeft + card.offsetWidth / 2),
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        setActiveIndex(closestIndex);
    }, []);

    const move = useCallback(
        (direction: 1 | -1) => goTo(activeIndex + direction),
        [activeIndex, goTo],
    );

    /* Center the chosen database, then hold still so the choice stays readable. */
    useEffect(() => {
        if (activeSource === "all") return;
        const index = SOURCES.findIndex(
            (source) => source.value === activeSource,
        );
        if (index >= 0) goTo(index);
    }, [activeSource, goTo]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (
            !viewport ||
            paused ||
            hasFocus ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return;
        }

        const timer = window.setInterval(() => move(1), 3_600);

        return () => window.clearInterval(timer);
    }, [hasFocus, move, paused]);

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
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocusCapture={() => setPaused(true)}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setPaused(false);
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
                    onPointerDown={() => setPaused(true)}
                    onPointerUp={() => setPaused(false)}
                    onScroll={syncActiveSource}
                >
                    <div className={styles.chipTrack}>
                        {SOURCES.map((source, index) => {
                            const isActive = activeSource === source.value;
                            const isCarouselActive = activeIndex === index;
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
                                    key={source.value}
                                    type="button"
                                    className={clsx(
                                        styles.chip,
                                        SOURCE_CLASS[source.value],
                                        isActive && styles.chipActive,
                                        isCarouselActive &&
                                            styles.chipCarouselActive,
                                    )}
                                    onClick={() => {
                                        goTo(index);
                                        onSelect(
                                            source.value as SearchableMindSource,
                                        );
                                    }}
                                    aria-pressed={isActive}
                                >
                                    {content}
                                </button>
                            ) : (
                                <div
                                    key={source.value}
                                    className={clsx(
                                        styles.chip,
                                        styles.indexChip,
                                        SOURCE_CLASS[source.value],
                                        isCarouselActive &&
                                            styles.chipCarouselActive,
                                    )}
                                    title="Used in multi-database Discover synthesis"
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
                <div
                    className={styles.carouselDots}
                    aria-label="Choose database slide"
                >
                    {SOURCES.map((source, index) => (
                        <button
                            key={source.value}
                            type="button"
                            className={clsx(
                                styles.carouselDot,
                                index === activeIndex &&
                                    styles.carouselDotActive,
                            )}
                            onClick={() => goTo(index)}
                            aria-label={`Show ${source.name}`}
                            aria-current={
                                index === activeIndex ? "true" : undefined
                            }
                        />
                    ))}
                </div>
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
