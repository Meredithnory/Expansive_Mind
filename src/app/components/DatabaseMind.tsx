import React from "react";
import Image from "next/image";
import clsx from "clsx";
import styles from "./styles/databasemind.module.scss";

export type MindSource = "nih" | "springer" | "scholar";

const SOURCES: {
    value: MindSource;
    name: string;
    detail: string;
}[] = [
    { value: "nih", name: "NIH PubMed Central", detail: "PMC open access" },
    {
        value: "springer",
        name: "Springer Nature",
        detail: "Open access publications",
    },
    { value: "scholar", name: "Google Scholar", detail: "Ranked by relevance" },
];

const SOURCE_CLASS: Record<MindSource, string> = {
    nih: styles.nih,
    springer: styles.springer,
    scholar: styles.scholar,
};

/* Orbit angles: where each database satellite rides the ring */
const ANGLE_CLASS: Record<MindSource, string> = {
    nih: styles.angleNih,
    springer: styles.angleSpringer,
    scholar: styles.angleScholar,
};

interface DatabaseMindProps {
    activeSource: "all" | MindSource;
    onSelect: (source: MindSource) => void;
}

const FOCUS_CLASS: Record<MindSource, string> = {
    nih: styles.focusNih,
    springer: styles.focusSpringer,
    scholar: styles.focusScholar,
};

const DatabaseMind = ({ activeSource, onSelect }: DatabaseMindProps) => {
    const hasFocus = activeSource !== "all";

    return (
        <div
            className={clsx(
                styles.panel,
                hasFocus && styles.panelFocused,
                hasFocus && FOCUS_CLASS[activeSource as MindSource],
            )}
        >
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

            <div className={styles.chips}>
                {SOURCES.map((source) => {
                    const isActive = activeSource === source.value;

                    return (
                        <button
                            key={source.value}
                            type="button"
                            className={clsx(
                                styles.chip,
                                SOURCE_CLASS[source.value],
                                isActive && styles.chipActive,
                            )}
                            onClick={() => onSelect(source.value)}
                            aria-pressed={isActive}
                        >
                            <span className={styles.chipDot} aria-hidden />
                            <span className={styles.chipText}>
                                <span className={styles.chipName}>
                                    {source.name}
                                </span>
                                <span className={styles.chipDetail}>
                                    {source.detail}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default DatabaseMind;
