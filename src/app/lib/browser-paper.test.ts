import { afterEach, describe, expect, it, vi } from "vitest";
import {
    browserFullTextUrls,
    loadBrowserFullText,
    parseBrowserFullText,
} from "./browser-paper";

const withBody = `<?xml version="1.0"?>
<pmc-articleset><article xmlns:xlink="http://www.w3.org/1999/xlink">
<front><article-meta><abstract><p>Short abstract.</p></abstract></article-meta></front>
<body>
<sec><title>Results</title><p>Sample size was 42.</p>
<fig id="f1"><label>Figure 1</label><caption><p>Outcome.</p></caption>
<graphic xlink:href="f1"/></fig></sec>
</body></article></pmc-articleset>`;

const abstractOnly = `<?xml version="1.0"?>
<pmc-articleset><article><front><article-meta>
<abstract><p>Short abstract.</p></abstract>
</article-meta></front></article></pmc-articleset>`;

const mediaUrls = {
    f1: "https://pmc-oa-opendata.s3.amazonaws.com/PMC1/f1.jpg",
};

describe("browserFullTextUrls", () => {
    it("asks NIH first, then Europe PMC, without an API key or email", () => {
        const [ncbi, europePmc] = browserFullTextUrls("PMC123");
        expect(ncbi).toContain("eutils.ncbi.nlm.nih.gov");
        expect(ncbi).toContain("id=123");
        expect(ncbi).not.toContain("api_key");
        expect(ncbi).not.toContain("email");
        expect(europePmc).toContain("/PMC123/fullTextXML");
    });
});

describe("parseBrowserFullText", () => {
    it("returns body sections with figures locked for reading only", () => {
        const sections = parseBrowserFullText(withBody, mediaUrls);
        const results = sections?.find((section) => section.title === "Results");
        expect(results?.content).toContain("Sample size was 42.");
        const figure = sections
            ?.flatMap((section) => section.figures || [])
            .find((entry) => entry.label === "Figure 1");
        expect(figure?.imageUrl).toBe(mediaUrls.f1);
        expect(figure?.canAnalyzeSourceImage).toBe(false);
        expect(figure?.displayOnly).toBe(true);
    });

    it("returns null when NIH sends only the abstract", () => {
        expect(parseBrowserFullText(abstractOnly, mediaUrls)).toBeNull();
    });
});

describe("loadBrowserFullText", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("falls back to Europe PMC when NIH has no body", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(abstractOnly))
            .mockResolvedValueOnce(new Response(withBody));
        vi.stubGlobal("fetch", fetchMock);

        const sections = await loadBrowserFullText({
            provider: "pmc",
            pmcid: "123",
            mediaUrls,
        });

        expect(sections).not.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toContain("europepmc");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "omit" });
    });

    it("returns null when neither source has the body", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("", { status: 404 })),
        );
        await expect(
            loadBrowserFullText({ provider: "pmc", pmcid: "123", mediaUrls }),
        ).resolves.toBeNull();
    });
});
