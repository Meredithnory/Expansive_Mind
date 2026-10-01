/**
 * How long a fresh Discover run usually takes, question to report. Measured
 * 2026-09-30 on recent runs with the current pipeline (question check,
 * papers, report, business section): 117–148 s, median 145 s. A cached
 * question returns at once.
 */
export const TYPICAL_RUN_SECONDS = 150;

export type CountdownState = {
    /** "About 2:05 left", or the overtime line once the estimate passes. */
    text: string;
    overtime: boolean;
    /** 0–1, for the bar. Holds near full in overtime rather than claiming done. */
    progress: number;
};

export function discoveryCountdown(
    elapsedSeconds: number,
    typicalSeconds = TYPICAL_RUN_SECONDS,
): CountdownState {
    const elapsed = Math.max(0, elapsedSeconds);
    const remaining = Math.ceil(typicalSeconds - elapsed);
    if (remaining <= 0) {
        return {
            text: "Taking a little longer than usual. Still working on your report.",
            overtime: true,
            progress: 0.97,
        };
    }
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, "0");
    return {
        text: `About ${minutes}:${seconds} left`,
        overtime: false,
        progress: Math.min(0.97, elapsed / typicalSeconds),
    };
}
