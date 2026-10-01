import { describe, expect, it } from "vitest";
import { discoveryCountdown, TYPICAL_RUN_SECONDS } from "./discovery-countdown";

describe("discoveryCountdown", () => {
    it("starts at the typical run time", () => {
        expect(discoveryCountdown(0).text).toBe("About 2:30 left");
        expect(TYPICAL_RUN_SECONDS).toBe(150);
    });

    it("counts down in minutes and seconds", () => {
        expect(discoveryCountdown(25).text).toBe("About 2:05 left");
        expect(discoveryCountdown(140.2).text).toBe("About 0:10 left");
        expect(discoveryCountdown(149.5).text).toBe("About 0:01 left");
    });

    it("says it's taking longer instead of sitting at 0:00", () => {
        const late = discoveryCountdown(151);
        expect(late.overtime).toBe(true);
        expect(late.text).toBe(
            "Taking a little longer than usual. Still working on your report.",
        );
    });

    it("fills the bar with time but never shows it complete while working", () => {
        expect(discoveryCountdown(75).progress).toBeCloseTo(0.5);
        expect(discoveryCountdown(149).progress).toBeLessThan(1);
        expect(discoveryCountdown(400).progress).toBeLessThan(1);
    });
});
