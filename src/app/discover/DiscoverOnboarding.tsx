"use client";

import { useEffect, useState } from "react";
import styles from "./discover-onboarding.module.scss";

const TOUR_KEY = "expansive-mind-discover-tour-v1";

const STEPS = [
    {
        eyebrow: "Search",
        title: "Ask one focused question",
        body: "We search five literature indexes and remove duplicates.",
        visual: "search",
    },
    {
        eyebrow: "Read",
        title: "We read the strongest papers",
        body: "Up to 10 accessible papers become cited findings—not a link dump.",
        visual: "read",
    },
    {
        eyebrow: "Synthesize",
        title: "You get two useful views",
        body: "Science shows the evidence. Opportunity shows gaps, ventures, and scenarios.",
        visual: "synthesize",
    },
] as const;

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
    if (kind === "search") {
        return (
            <svg viewBox="0 0 260 120" aria-hidden="true">
                <circle className={styles.orbit} cx="130" cy="60" r="43" />
                <circle className={styles.orbitInner} cx="130" cy="60" r="24" />
                <circle className={styles.nodePink} cx="87" cy="60" r="6" />
                <circle className={styles.nodeBlue} cx="151" cy="20" r="5" />
                <circle className={styles.nodeViolet} cx="166" cy="93" r="5" />
                <path className={styles.lens} d="M119 50a16 16 0 1 0 22 22 16 16 0 0 0-22-22Zm22 22 15 15" />
            </svg>
        );
    }
    if (kind === "read") {
        return (
            <svg viewBox="0 0 260 120" aria-hidden="true">
                <rect className={styles.paperBack} x="73" y="28" width="82" height="70" rx="8" />
                <rect className={styles.paperFront} x="105" y="18" width="82" height="78" rx="8" />
                <path className={styles.paperLine} d="M121 39h48M121 52h38M121 65h45" />
                <path className={styles.scanLine} d="M111 75h70" />
                <circle className={styles.citationDot} cx="174" cy="39" r="4" />
                <circle className={styles.citationDot} cx="164" cy="65" r="4" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 260 120" aria-hidden="true">
            <rect className={styles.report} x="57" y="22" width="146" height="78" rx="10" />
            <path className={styles.chartAxis} d="M79 78V44M79 78h48" />
            <path className={styles.chartLine} d="m84 68 12-12 10 5 16-19" />
            <rect className={styles.reportLine} x="145" y="43" width="37" height="5" rx="2.5" />
            <rect className={styles.reportLine} x="145" y="56" width="29" height="5" rx="2.5" />
            <rect className={styles.reportLine} x="145" y="69" width="34" height="5" rx="2.5" />
            <circle className={styles.chartPoint} cx="122" cy="42" r="5" />
        </svg>
    );
}

export default function DiscoverOnboarding({
    onTry,
}: {
    onTry: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        try {
            if (!window.localStorage.getItem(TOUR_KEY)) {
                const frame = window.requestAnimationFrame(() => setOpen(true));
                return () => window.cancelAnimationFrame(frame);
            }
        } catch {
            // Storage can be unavailable in privacy mode; the trigger remains.
        }
    }, []);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            try {
                window.localStorage.setItem(TOUR_KEY, "seen");
            } catch {
                // The tour still closes for this page view.
            }
            setOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open]);

    const remember = () => {
        try {
            window.localStorage.setItem(TOUR_KEY, "seen");
        } catch {
            // The tour still closes for this page view.
        }
    };

    const close = () => {
        remember();
        setOpen(false);
    };

    const finish = () => {
        close();
        onTry();
    };

    if (!open) {
        return (
            <button
                type="button"
                className={styles.trigger}
                onClick={() => {
                    setStep(0);
                    setOpen(true);
                }}
            >
                <span className={styles.triggerPlay} aria-hidden="true">▶</span>
                How discovery works
                <span>30 sec</span>
            </button>
        );
    }

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <aside
            className={styles.coachmark}
            role="dialog"
            aria-modal="false"
            aria-labelledby="discover-tour-title"
        >
            <div className={styles.visual}>
                <StepVisual kind={current.visual} />
            </div>
            <div className={styles.progress} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
                {STEPS.map((item, index) => (
                    <button
                        key={item.eyebrow}
                        type="button"
                        className={index === step ? styles.progressActive : ""}
                        onClick={() => setStep(index)}
                        aria-label={`Go to ${item.eyebrow} step`}
                        aria-current={index === step ? "step" : undefined}
                    />
                ))}
            </div>
            <p className={styles.eyebrow}>
                {step + 1} of {STEPS.length} · {current.eyebrow}
            </p>
            <h2 id="discover-tour-title">{current.title}</h2>
            <p className={styles.body}>{current.body}</p>
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.skip}
                    onClick={() => {
                        if (step === 0) {
                            close();
                        } else {
                            setStep((value) => value - 1);
                        }
                    }}
                >
                    {step === 0 ? "Skip" : "Back"}
                </button>
                <button
                    type="button"
                    className={styles.next}
                    onClick={() => {
                        if (isLast) {
                            finish();
                        } else {
                            setStep((value) => value + 1);
                        }
                    }}
                >
                    {isLast ? "Try discovery" : "Next"}
                    <span aria-hidden="true">→</span>
                </button>
            </div>
        </aside>
    );
}
