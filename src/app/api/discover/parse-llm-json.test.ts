import { describe, expect, it } from "vitest";
import { parseJsonFromLlm, removeStrayClosers } from "./parse-llm-json";

// The shape gpt-4.1-mini returned for Discover extractions on 2026-09-30:
// a stray "]" after the methodsQuote string made the whole reply unreadable.
const STRAY_BRACKET_REPLY =
    '{"keyFindings":[{"finding":"Off-target cuts occur.","quote":"Cas9 cleaves off-target sites."}],' +
    '"methods":"Review.","methodsQuote":"We compared GUIDE-seq with CIRCLE-seq in real target cells."],' +
    '"limitations":["Small panels."],"openQuestions":[],"evidenceType":"review"}';

describe("parseJsonFromLlm", () => {
    it("reads a reply with a stray ] after a string field", () => {
        expect(parseJsonFromLlm(STRAY_BRACKET_REPLY)).toEqual({
            keyFindings: [
                { finding: "Off-target cuts occur.", quote: "Cas9 cleaves off-target sites." },
            ],
            methods: "Review.",
            methodsQuote: "We compared GUIDE-seq with CIRCLE-seq in real target cells.",
            limitations: ["Small panels."],
            openQuestions: [],
            evidenceType: "review",
        });
    });

    it("still reads normal and fenced JSON unchanged", () => {
        expect(parseJsonFromLlm('{"a":[1,2],"b":"x"}')).toEqual({ a: [1, 2], b: "x" });
        expect(parseJsonFromLlm('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it("still repairs a reply cut off mid-array", () => {
        expect(parseJsonFromLlm('{"a":["one","two"')).toEqual({ a: ["one", "two"] });
    });
});

describe("removeStrayClosers", () => {
    it("drops only closers that don't match the open bracket", () => {
        expect(removeStrayClosers('{"a":"b"],"c":[1}]}')).toBe('{"a":"b","c":[1]}');
    });

    it("leaves brackets inside strings alone", () => {
        const text = '{"quote":"Values [n = 3] were ] ignored }","x":1}';
        expect(removeStrayClosers(text)).toBe(text);
    });

    it("respects escaped quotes inside strings", () => {
        const text = '{"q":"He said \\"]\\" once"}';
        expect(removeStrayClosers(text)).toBe(text);
    });
});
