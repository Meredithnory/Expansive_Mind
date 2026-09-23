import { describe, expect, it } from "vitest";
import {
    buildResearchModeUrl,
    parseResearchMode,
    researchHref,
} from "./research-mode";

describe("parseResearchMode", () => {
    it("defaults to discover and accepts search", () => {
        expect(parseResearchMode(undefined)).toBe("discover");
        expect(parseResearchMode("discover")).toBe("discover");
        expect(parseResearchMode("search")).toBe("search");
        expect(parseResearchMode(["search"])).toBe("search");
    });
});

describe("researchHref", () => {
    it("builds discover and search entry URLs", () => {
        expect(researchHref("discover")).toBe("/discover");
        expect(researchHref("search")).toBe("/discover?mode=search");
        expect(researchHref("search", { q: "CRISPR", page: "1" })).toBe(
            "/discover?mode=search&q=CRISPR&page=1",
        );
    });
});

describe("buildResearchModeUrl", () => {
    it("keeps the shared query when switching modes", () => {
        expect(
            buildResearchModeUrl(
                "search",
                { q: "CAR-T", saved: "abc", mode: "discover" },
            ),
        ).toBe("/discover?q=CAR-T&mode=search");
        expect(
            buildResearchModeUrl("discover", {
                q: "CAR-T",
                mode: "search",
                page: "2",
                source: "nih",
            }),
        ).toBe("/discover?q=CAR-T");
    });

    it("reads live URLSearchParams-like objects", () => {
        const live = new URLSearchParams("mode=search&q=microbiome&page=1");
        expect(buildResearchModeUrl("discover", live)).toBe(
            "/discover?q=microbiome",
        );
        expect(buildResearchModeUrl("search", live)).toBe(
            "/discover?q=microbiome&mode=search&page=1",
        );
    });
});
