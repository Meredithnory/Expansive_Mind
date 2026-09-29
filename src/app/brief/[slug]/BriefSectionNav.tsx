"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./brief.module.scss";

export type BriefNavItem = { id: string; label: string; count?: number };

/** "On this page": marks the section in view as the reader scrolls. */
export default function BriefSectionNav({ items }: { items: BriefNavItem[] }) {
    const [active, setActive] = useState(items[0]?.id ?? "");

    useEffect(() => {
        const sections = items
            .map((item) => document.getElementById(item.id))
            .filter((node): node is HTMLElement => Boolean(node));
        if (sections.length === 0 || !("IntersectionObserver" in window)) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "-20% 0px -70% 0px" },
        );
        sections.forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, [items]);

    return (
        <nav className={styles.sectionNav} aria-label="On this page">
            <span className={styles.sectionNavLabel}>On this page</span>
            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            className={clsx(styles.sectionLink, {
                                [styles.sectionLinkActive]: active === item.id,
                            })}
                            aria-current={active === item.id ? "location" : undefined}
                            onClick={() => setActive(item.id)}
                        >
                            {item.label}
                            {item.count !== undefined ? (
                                <span className={styles.sectionCount}>{item.count}</span>
                            ) : null}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
