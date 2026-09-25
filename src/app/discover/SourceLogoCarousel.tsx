"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { attachHorizontalRail } from "../lib/horizontal-rail";
import styles from "./source-logo-carousel.module.scss";

const SOURCES = [
    {
        name: "Springer Nature",
        role: "Publisher corpus",
        logo: "/source-logos/springer-nature.svg",
        logoClass: styles.logoWide,
    },
    {
        name: "NIH PubMed Central",
        role: "Full-text archive",
        logo: "/source-logos/nih-pmc.png",
        logoClass: styles.logoMark,
    },
    {
        name: "Google Scholar",
        role: "Citation discovery",
        logo: "/source-logos/google-scholar.svg",
        logoClass: styles.logoMark,
    },
    {
        name: "Europe PMC",
        role: "Biomedical index",
        logo: "/source-logos/europe-pmc.png",
        logoClass: styles.logoWideLight,
    },
    {
        name: "Crossref",
        role: "DOI metadata",
        logo: "/source-logos/crossref.svg",
        logoClass: styles.logoWideLight,
    },
] as const;

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

export default function SourceLogoCarousel() {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [paused, setPaused] = useState(false);
    const [activeName, setActiveName] = useState<string>(SOURCES[0].name);

    const syncActiveSource = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        normalizeLoop(viewport);
        const center = viewport.scrollLeft + viewport.clientWidth / 2;
        const cards = Array.from(
            viewport.querySelectorAll<HTMLElement>(`.${styles.sourceCard}`),
        );
        let closestName: string = SOURCES[0].name;
        let closestDistance = Number.POSITIVE_INFINITY;
        cards.forEach((card) => {
            const distance = Math.abs(
                center - (card.offsetLeft + card.offsetWidth / 2),
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closestName = card.dataset.name ?? closestName;
            }
        });
        setActiveName(closestName);
    }, []);

    const move = (direction: 1 | -1) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const card = viewport.querySelector<HTMLElement>(`.${styles.sourceCard}`);
        const step = (card?.offsetWidth ?? 188) + 10;
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
            className={styles.carousel}
            role="region"
            aria-label="Research sources"
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
                className={`${styles.arrow} ${styles.arrowPrevious}`}
                onClick={() => move(-1)}
                aria-label="Previous research sources"
            >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m10 3-5 5 5 5" />
                </svg>
            </button>
            <div
                ref={viewportRef}
                className={styles.viewport}
                data-paused={paused}
                onScroll={syncActiveSource}
                onPointerDown={() => setPaused(true)}
                onPointerUp={() => setPaused(false)}
                onPointerCancel={() => setPaused(false)}
            >
                <div className={styles.track}>
                    {LOOP.map((source, index) => (
                        <div
                            className={styles.sourceCard}
                            data-active={activeName === source.name}
                            data-name={source.name}
                            key={`${source.copy}-${source.name}-${index}`}
                            aria-hidden={source.copy !== 1}
                        >
                            <span className={styles.logoFrame}>
                                <Image
                                    className={source.logoClass}
                                    src={source.logo}
                                    alt=""
                                    width={110}
                                    height={32}
                                />
                            </span>
                            <span className={styles.sourceCopy}>
                                <strong>{source.name}</strong>
                                <small>{source.role}</small>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <button
                type="button"
                className={`${styles.arrow} ${styles.arrowNext}`}
                onClick={() => move(1)}
                aria-label="Next research sources"
            >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m6 3 5 5-5 5" />
                </svg>
            </button>
        </div>
    );
}
