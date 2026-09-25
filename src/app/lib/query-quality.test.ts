import { describe, expect, it } from "vitest";
import {
    discoveryDisplayTitle,
    looksLikeUnclearResearchQuestion,
    spellingGateDecision,
} from "./query-quality";

describe("looksLikeUnclearResearchQuestion", () => {
    it("flags keyboard walks and smashed keys", () => {
        expect(looksLikeUnclearResearchQuestion("asdf")).toBe(true);
        expect(looksLikeUnclearResearchQuestion("qwerty")).toBe(true);
        expect(looksLikeUnclearResearchQuestion("bcdfgh")).toBe(true);
        expect(looksLikeUnclearResearchQuestion("aaaaaa")).toBe(true);
    });

    it("leaves real questions and scientific terms alone", () => {
        expect(
            looksLikeUnclearResearchQuestion(
                "How to cure post inflammry hyperpigmentation on skin?",
            ),
        ).toBe(false);
        expect(looksLikeUnclearResearchQuestion("CRISPR Cas9")).toBe(false);
        expect(looksLikeUnclearResearchQuestion("senolytics")).toBe(false);
        expect(looksLikeUnclearResearchQuestion("efrerg")).toBe(false);
    });
});

describe("discoveryDisplayTitle", () => {
    it("prefers the corrected question when present", () => {
        expect(
            discoveryDisplayTitle(
                "How to cure post inflammry hyperpigmentation on skin?",
                "How to cure post inflammatory hyperpigmentation on skin?",
            ),
        ).toBe("How to cure post inflammatory hyperpigmentation on skin?");
    });

    it("falls back to the original question", () => {
        expect(discoveryDisplayTitle("GLP-1 and aging", null)).toBe(
            "GLP-1 and aging",
        );
    });
});

describe("spellingGateDecision", () => {
    it("asks the user to confirm a spelling fix before searching", () => {
        expect(
            spellingGateDecision({
                status: "corrected",
                suggestion:
                    "how to cure inflammatory hyperpigmentation",
            }),
        ).toBe("confirm");
    });

    it("blocks unintelligible input and runs clear questions", () => {
        expect(
            spellingGateDecision({ status: "unclear", suggestion: null }),
        ).toBe("block");
        expect(spellingGateDecision({ status: "ok", suggestion: null })).toBe(
            "run",
        );
        expect(spellingGateDecision(null)).toBe("run-anyway");
    });
});
