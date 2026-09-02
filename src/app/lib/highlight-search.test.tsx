import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HighlightSearchTitle } from "./highlight-search";

describe("HighlightSearchTitle", () => {
    it("renders provider titles as text rather than HTML", () => {
        const html = renderToStaticMarkup(
            <HighlightSearchTitle
                title="<em>Paper</em>"
                searchValue="paper"
                highlightClass="match"
            />,
        );

        expect(html).toContain("&lt;em&gt;");
        expect(html).not.toContain("<em>");
    });
});
