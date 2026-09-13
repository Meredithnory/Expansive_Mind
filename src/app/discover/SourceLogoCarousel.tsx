"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
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

export default function SourceLogoCarousel() {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [paused, setPaused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const scrollToSource = useCallback((index: number) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const cards = viewport.querySelectorAll<HTMLElement>(
            `.${styles.sourceCard}`,
        );
        const targetIndex = (index + SOURCES.length) % SOURCES.length;
        const card = cards[targetIndex];
        if (!card) return;
        viewport.scrollTo({
            left: card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2,
            behavior: "smooth",
        });
        setActiveIndex(targetIndex);
    }, []);

    const move = (direction: 1 | -1) => {
        scrollToSource(activeIndex + direction);
    };

    const syncActiveSource = () => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const center = viewport.scrollLeft + viewport.clientWidth / 2;
        const cards = Array.from(
            viewport.querySelectorAll<HTMLElement>(`.${styles.sourceCard}`),
        );
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        cards.forEach((card, index) => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            const distance = Math.abs(center - cardCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        setActiveIndex(closestIndex);
    };

    useEffect(() => {
        const viewport = viewportRef.current;
        if (
            !viewport ||
            paused ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return;
        }

        const timer = window.setInterval(() => {
            scrollToSource(activeIndex + 1);
        }, 3_600);
        return () => window.clearInterval(timer);
    }, [activeIndex, paused, scrollToSource]);

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
                onScroll={syncActiveSource}
                onPointerDown={() => setPaused(true)}
                onPointerUp={() => setPaused(false)}
            >
                <div className={styles.track}>
                    {SOURCES.map((source, index) => (
                        <button
                            type="button"
                            className={styles.sourceCard}
                            data-active={activeIndex === index}
                            key={source.name}
                            onClick={() => scrollToSource(index)}
                            aria-label={`${source.name}, ${source.role}`}
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
                        </button>
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
            <div className={styles.progress} aria-hidden="true">
                {SOURCES.map((source, index) => (
                    <span
                        key={source.name}
                        data-active={activeIndex === index}
                    />
                ))}
            </div>
        </div>
    );
}
