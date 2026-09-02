import { describe, expect, it } from "vitest";
import { buildSpringerImageUrl } from "./springer-media";

const doi = "10.1186/s12917-015-0540-4";
const cdnUrl =
    "https://media.springernature.com/original/springer-static/image/art%3A10.1186%2Fs12917-015-0540-4/MediaObjects/12917_2015_540_Fig2_HTML.gif";

describe("buildSpringerImageUrl", () => {
    it("maps JATS MediaObjects hrefs onto the Springer CDN", () => {
        expect(
            buildSpringerImageUrl(
                "MediaObjects/12917_2015_540_Fig2_HTML.gif",
                doi,
            ),
        ).toBe(cdnUrl);
    });

    it("prefixes bare filenames with MediaObjects", () => {
        expect(
            buildSpringerImageUrl("12917_2015_540_Fig2_HTML.gif", doi),
        ).toBe(cdnUrl);
    });

    it("rewrites link.springer.com MediaObjects paths that 404 in the browser", () => {
        expect(
            buildSpringerImageUrl(
                "https://link.springer.com/MediaObjects/12917_2015_540_Fig2_HTML.gif",
                doi,
            ),
        ).toBe(cdnUrl);
    });

    it("keeps already-valid Springer CDN URLs, including protocol-relative ones", () => {
        expect(buildSpringerImageUrl(cdnUrl, doi)).toBe(cdnUrl);
        expect(
            buildSpringerImageUrl(cdnUrl.replace("https:", ""), doi),
        ).toBe(cdnUrl);
        expect(
            buildSpringerImageUrl(
                "https://static-content.springer.com/image/art%3A10.1186%2Fs12917-015-0540-4/MediaObjects/12917_2015_540_Fig2_HTML.gif",
                doi,
            ),
        ).toContain("static-content.springer.com");
    });

    it("rejects unknown hosts and empty input", () => {
        expect(buildSpringerImageUrl("https://example.com/fig.gif", doi)).toBe(
            "",
        );
        expect(buildSpringerImageUrl("MediaObjects/fig.gif", "")).toBe("");
        expect(buildSpringerImageUrl("", doi)).toBe("");
    });
});
