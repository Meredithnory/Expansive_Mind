import { describe, expect, it } from "vitest";
import { funnelSteps, parsePulseRange, questionTopics } from "./admin-pulse";

describe("parsePulseRange", () => {
    it("accepts 7, 30, or 90 days and defaults to 30", () => {
        expect(parsePulseRange("7")).toBe(7);
        expect(parsePulseRange("90")).toBe(90);
        expect(parsePulseRange("12")).toBe(30);
        expect(parsePulseRange(null)).toBe(30);
    });
});

describe("funnelSteps", () => {
    it("gives each step its share of the step before", () => {
        const steps = funnelSteps([
            { id: "a", label: "A", detail: "", count: 200 },
            { id: "b", label: "B", detail: "", count: 50 },
            { id: "c", label: "C", detail: "", count: 0 },
            { id: "d", label: "D", detail: "", count: 3 },
        ]);
        expect(steps.map((step) => step.rate)).toEqual([null, 25, 0, null]);
    });
});

describe("questionTopics", () => {
    const current = [
        { question: "How are off-target effects of base editing assessed?", shared: true },
        { question: "Base editing off-target detection in human cells", shared: false },
        { question: "Does GLP-1 agonism reduce cardiovascular events?", shared: true },
        { question: "GLP-1 agonists and kidney outcomes", shared: false },
        { question: "Base editing delivery to the liver", shared: false },
        { question: "Senolytics in Alzheimer disease", shared: false },
    ];

    it("groups questions by the phrases they share, most common first", () => {
        const topics = questionTopics(current, ["Base editing in sickle cell disease"]);
        expect(topics[0]).toEqual({ topic: "base editing", runs: 3, shared: 1, prior: 1 });
        expect(topics.map((topic) => topic.topic)).toContain("glp-1");
        expect(topics.find((topic) => topic.topic === "glp-1")).toMatchObject({ runs: 2, shared: 1, prior: 0 });
    });

    it("never repeats a word across two topics", () => {
        const words = questionTopics(current, []).flatMap((topic) => topic.topic.split(" "));
        expect(new Set(words).size).toBe(words.length);
    });

    it("returns nothing for no questions", () => {
        expect(questionTopics([], [])).toEqual([]);
    });
});
