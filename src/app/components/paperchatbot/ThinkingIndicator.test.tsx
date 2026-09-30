import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ThinkingIndicator from "./ThinkingIndicator";
import { THINKING_WORDS } from "./thinking-words";

describe("ThinkingIndicator", () => {
    const html = renderToStaticMarkup(<ThinkingIndicator />);

    it("keeps the status label the verify skill waits on", () => {
        expect(html).toContain('role="status"');
        expect(html).toContain('aria-label="Assistant is thinking"');
    });

    it("shows one science word with an ellipsis", () => {
        const shown = THINKING_WORDS.filter((word) =>
            html.includes(`${word}…`),
        );
        expect(shown).toHaveLength(1);
    });

    it("gives screen readers one steady line instead of the changing word", () => {
        expect(html).toContain("Reading the paper…");
        expect(html).toMatch(/aria-hidden="true"[^>]*>[A-Za-z-]+…</);
    });
});
