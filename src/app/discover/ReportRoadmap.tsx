"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "./discover.module.scss";
import type { OpportunityReport } from "../api/discover/report-types";
import { reportRoadmapSteps } from "./report-sections";

function prefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ReportRoadmap({
    report,
}: {
    report: OpportunityReport;
}) {
    const steps = useMemo(() => reportRoadmapSteps(report), [report]);
    const [activeKey, setActiveKey] = useState<string | null>(
        steps[0]?.key ?? null,
    );

    useEffect(() => {
        if (steps.length === 0) return;

        const nodes = steps
            .map((step) => document.getElementById(step.anchor))
            .filter((node): node is HTMLElement => Boolean(node));
        if (nodes.length === 0) return;

        const scrollRoot =
            document.querySelector<HTMLElement>(".main-content") ?? null;
        const visible = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.id;
                    if (entry.isIntersecting) {
                        visible.set(id, entry.intersectionRatio);
                    } else {
                        visible.delete(id);
                    }
                }
                let bestAnchor: string | null = null;
                let bestRatio = -1;
                for (const step of steps) {
                    const ratio = visible.get(step.anchor) ?? -1;
                    if (ratio > bestRatio) {
                        bestRatio = ratio;
                        bestAnchor = step.anchor;
                    }
                }
                if (!bestAnchor) return;
                const match = steps.find((step) => step.anchor === bestAnchor);
                if (match) setActiveKey(match.key);
            },
            {
                root: scrollRoot,
                rootMargin: "-10% 0px -55% 0px",
                threshold: [0, 0.15, 0.35, 0.55, 0.75],
            },
        );

        for (const node of nodes) observer.observe(node);
        return () => observer.disconnect();
    }, [steps]);

    const scrollToStep = useCallback((anchor: string) => {
        const target = document.getElementById(anchor);
        if (!target) return;
        target.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "start",
        });
    }, []);

    if (steps.length < 2) return null;

    return (
        <nav className={styles.reportRoadmap} aria-label="Report roadmap">
            <div className={styles.roadmapHead}>
                <p className={styles.sectionKicker}>Report path</p>
                <p className={styles.roadmapHint}>
                    Jump to a section. Labels come from this report.
                </p>
            </div>
            <ol className={styles.roadmapTrack}>
                {steps.map((step, index) => (
                    <li key={step.key} className={styles.roadmapItem}>
                        {index > 0 ? (
                            <span
                                className={styles.roadmapConnector}
                                aria-hidden="true"
                            />
                        ) : null}
                        <button
                            type="button"
                            className={clsx(styles.roadmapStep, {
                                [styles.roadmapStepActive]:
                                    activeKey === step.key,
                                [styles.roadmapStepGap]: step.kind === "gap",
                            })}
                            aria-current={
                                activeKey === step.key ? "step" : undefined
                            }
                            onClick={() => scrollToStep(step.anchor)}
                        >
                            <span className={styles.roadmapNumber}>
                                {step.number}
                            </span>
                            <span className={styles.roadmapLabel}>
                                {step.label}
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
