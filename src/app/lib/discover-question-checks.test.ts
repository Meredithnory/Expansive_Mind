import { describe, expect, it } from "vitest";
import { questionChecks } from "./discover-question-checks";

const passed = (question: string) =>
    questionChecks(question).filter((check) => check.ok).map((check) => check.id);

describe("questionChecks", () => {
    it("passes a specific question with a subject and an outcome", () => {
        expect(
            passed("What limits CAR-T cell persistence and efficacy in solid tumors?"),
        ).toEqual(["specific", "subject", "outcome"]);
    });

    it("asks for more when the question is short and vague", () => {
        const checks = questionChecks("senolytics");
        expect(checks.every((check) => !check.ok)).toBe(true);
        expect(checks.map((check) => check.label)).toEqual([
            "Add a little more detail",
            "Who or what is it about?",
            "What outcome matters?",
        ]);
    });

    it("matches word starts, not letters inside other words", () => {
        expect(passed("gene therapy for treatment")).toEqual([]);
        expect(passed("does it reduce mortality in older adults")).toEqual([
            "specific",
            "subject",
            "outcome",
        ]);
    });

    it("counts a named condition as what the question is about", () => {
        expect(
            passed(
                "Does GLP-1 receptor agonism reduce cardiovascular events in type 2 diabetes?",
            ),
        ).toEqual(["specific", "subject", "outcome"]);
    });
});
