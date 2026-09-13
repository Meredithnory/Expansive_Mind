import { describe, expect, it } from "vitest";
import { classifyPaperTopic } from "./paper-topics";

describe("classifyPaperTopic", () => {
  it("weights title terms more strongly than abstract terms", () => {
    expect(
      classifyPaperTopic(
        "Protein intake deficiency during GLP-1 treatment",
        "Machine learning may support future analysis.",
      ),
    ).toBe("Metabolism & Nutrition");
  });

  it("recognizes research-method and regenerative papers", () => {
    expect(
      classifyPaperTopic(
        "An open science framework for documenting generative AI use",
      ),
    ).toBe("AI & Research Methods");
    expect(
      classifyPaperTopic(
        "Stem cell extracellular vesicles for skin rejuvenation",
      ),
    ).toBe("Dermatology & Regeneration");
  });

  it("uses a general category when no science-area terms match", () => {
    expect(classifyPaperTopic("A perspective on future opportunities")).toBe(
      "General Biomedical Research",
    );
  });
});
