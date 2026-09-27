import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuoteWithAttribution from "./QuoteWithAttribution";

const quote = "Events fell by 12% in the treatment arm.";

describe("QuoteWithAttribution", () => {
    it("renders the passage with the title and the link", () => {
        const html = renderToStaticMarkup(
            <QuoteWithAttribution
                quote={quote}
                title="Treatment arm outcomes"
                link="https://doi.org/10.1/one"
            />,
        );
        expect(html).toContain("<blockquote");
        expect(html).toContain(quote);
        expect(html).toContain('href="https://doi.org/10.1/one"');
        expect(html).toContain("Treatment arm outcomes");
    });

    it("omits the passage when the title or the link is missing", () => {
        expect(
            renderToStaticMarkup(
                <QuoteWithAttribution
                    quote={quote}
                    title=""
                    link="https://doi.org/10.1/one"
                />,
            ),
        ).toBe("");
        expect(
            renderToStaticMarkup(
                <QuoteWithAttribution
                    quote={quote}
                    title="Treatment arm outcomes"
                    link=""
                />,
            ),
        ).toBe("");
    });
});
