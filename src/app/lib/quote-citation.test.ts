import { describe, expect, it } from "vitest";
import { formatQuoteWithCitation } from "./quote-citation";

const attribution = {
    title: "GLP-1 receptor agonists beyond glycemic control",
    authors: ["Elsayed, Ahmed", "Ayoub, Wadah Jason", "Elsayed, Norhan", "Stephens, Joshua"],
    sourceLabel: "Springer Nature",
    canonicalUrl: "https://link.springer.com/article/10.1186/s40842-026-00322-3",
    paperId: "10.1186/s40842-026-00322-3",
    idName: "doi",
    publicationDate: "2026-09-07",
    doi: "10.1186/s40842-026-00322-3",
};

describe("formatQuoteWithCitation", () => {
    it("writes the quote, section, byline, DOI link, and license", () => {
        expect(
            formatQuoteWithCitation({
                excerpt: "only approximately 30–40% of the MACE\n reduction",
                sectionTitle: "Introduction",
                attribution,
                licenseName: "CC BY 4.0",
            }),
        ).toBe(
            "“only approximately 30–40% of the MACE reduction” (Introduction)\n" +
                "— Elsayed, Ahmed et al. (2026). GLP-1 receptor agonists beyond glycemic control. Springer Nature.\n" +
                "https://doi.org/10.1186/s40842-026-00322-3 · CC BY 4.0",
        );
    });

    it("lists up to three authors and falls back to the source page without a DOI", () => {
        const text = formatQuoteWithCitation({
            excerpt: "A finding.",
            attribution: { ...attribution, authors: ["Ada Lovelace", "Alan Turing"], doi: undefined, publicationDate: undefined },
        });
        expect(text).toBe(
            "“A finding.”\n" +
                "— Ada Lovelace; Alan Turing. GLP-1 receptor agonists beyond glycemic control. Springer Nature.\n" +
                "https://link.springer.com/article/10.1186/s40842-026-00322-3",
        );
    });
});
