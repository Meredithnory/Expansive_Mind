import { describe, expect, it } from "vitest";
import {
    buildSpringerFallbackQuery,
    buildSpringerSearchQuery,
    getMeaningfulSearchTerms,
    selectSpringerAnchor,
} from "./springer-query";

describe("buildSpringerSearchQuery", () => {
    it("keeps short topics as phrase OR AND", () => {
        const query = buildSpringerSearchQuery("cancer immunotherapy");
        expect(query).toContain('keyword:"cancer immunotherapy"');
        expect(query).toContain('keyword:"cancer" AND keyword:"immunotherapy"');
    });

    it("requires the biomedical anchor in a long research question", () => {
        const query = buildSpringerSearchQuery(
            "How does GLP-1 receptor agonism affect cardiovascular outcomes in type 2 diabetes?",
        );
        expect(query).toBe(
            '(keyword:"glp-1" AND keyword:"cardiovascular")',
        );
        expect(query).not.toContain('OR keyword:"diabetes"');
    });

    it("keeps GLP-1 required instead of returning general women's health", () => {
        const query = buildSpringerSearchQuery(
            "How does GLP-1 affect women in pregnancy?",
        );
        expect(query).toBe(
            '(keyword:"glp-1" AND keyword:"pregnancy")',
        );
        expect(query).not.toContain('OR keyword:"women"');
    });

    it("handles single-word searches", () => {
        expect(buildSpringerSearchQuery("diabetes")).toBe(
            'keyword:"diabetes"',
        );
    });
});

describe("buildSpringerFallbackQuery", () => {
    it("broadens to the anchor only", () => {
        const query = buildSpringerFallbackQuery(
            "How does GLP-1 receptor agonism affect cardiovascular outcomes in type 2 diabetes?",
        );
        expect(query).toBe('keyword:"glp-1"');
        expect(query).not.toContain("cardiovascular");
        expect(query).not.toContain(" OR ");
    });
});

describe("selectSpringerAnchor", () => {
    it("prioritizes numbered biomedical names", () => {
        const terms = getMeaningfulSearchTerms(
            "pregnancy outcomes with GLP-1 treatment",
        );
        expect(selectSpringerAnchor(terms)).toBe("glp-1");
    });

    it("otherwise preserves the first meaningful subject", () => {
        const terms = getMeaningfulSearchTerms(
            "How does semaglutide affect cardiovascular health?",
        );
        expect(selectSpringerAnchor(terms)).toBe("semaglutide");
    });
});
