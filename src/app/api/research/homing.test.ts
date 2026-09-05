import { describe, expect, it } from "vitest";
import { homeLead } from "./homing";
import type { WorkLead } from "./types";

const lead = (overrides: Partial<WorkLead> = {}): WorkLead => ({
    producer: "openalex",
    abstract: "A licensed PMC abstract.",
    citation: { title: "A work", authors: ["Ada"] },
    ...overrides,
});

describe("homeLead", () => {
    it("homes a PMCID onto nih and keeps a DOI", () => {
        const hit = homeLead(
            lead({
                pmcid: "PMC7654321",
                citation: {
                    title: "A work",
                    authors: ["Ada"],
                    doi: "https://doi.org/10.1000/oa-work",
                },
            }),
        );
        expect(hit).toMatchObject({
            database: "nih",
            paperId: "7654321",
            idName: "pmcid",
            doi: "10.1000/oa-work",
        });
    });

    it("drops DOI-only leads instead of guessing a Springer home", () => {
        expect(
            homeLead(
                lead({
                    citation: {
                        title: "No PMC",
                        authors: [],
                        doi: "10.1000/unbound",
                    },
                }),
            ),
        ).toBeNull();
    });
});
