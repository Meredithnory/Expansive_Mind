import { describe, expect, it } from "vitest";
import { isOpeningSavedSynthesis } from "./saved-synthesis-view";

const pendingSaved = {
    savedParam: "6aac8fa7a5ae790921b4b480",
    hasResult: false,
    hasError: false,
    sessionLoading: false,
    historyLoading: false,
    isLoggedIn: true,
};

describe("isOpeningSavedSynthesis", () => {
    it("keeps the Discover landing available for a normal Discover visit", () => {
        expect(
            isOpeningSavedSynthesis({
                savedParam: "",
                hasResult: false,
                hasError: false,
                sessionLoading: false,
                historyLoading: false,
                isLoggedIn: true,
            }),
        ).toBe(false);
    });

    it("treats a saved open as still loading while session is unresolved", () => {
        expect(
            isOpeningSavedSynthesis({
                ...pendingSaved,
                sessionLoading: true,
                isLoggedIn: false,
            }),
        ).toBe(true);
    });

    it("treats a saved open as still loading while history is fetching", () => {
        expect(
            isOpeningSavedSynthesis({
                ...pendingSaved,
                historyLoading: true,
            }),
        ).toBe(true);
    });

    it("covers the frame after fetch before the saved result is applied", () => {
        expect(isOpeningSavedSynthesis(pendingSaved)).toBe(true);
    });

    it("releases the gate once the saved synthesis is on screen", () => {
        expect(
            isOpeningSavedSynthesis({
                ...pendingSaved,
                hasResult: true,
            }),
        ).toBe(false);
    });

    it("releases the gate once the saved synthesis failed to load", () => {
        expect(
            isOpeningSavedSynthesis({
                ...pendingSaved,
                hasError: true,
            }),
        ).toBe(false);
    });

    it("does not hold a guest on a forever loader for ?saved=", () => {
        expect(
            isOpeningSavedSynthesis({
                ...pendingSaved,
                isLoggedIn: false,
            }),
        ).toBe(false);
    });
});
