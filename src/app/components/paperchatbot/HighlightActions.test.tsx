import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
    HighlightActionBar,
    HighlightActionSheet,
    HighlightHint,
    type HighlightActionHandlers,
} from "./HighlightActions";

const noop = () => undefined;
const handlers = (
    overrides: Partial<HighlightActionHandlers> = {},
): HighlightActionHandlers => ({
    color: "pink",
    copied: false,
    onColor: noop,
    onCopy: noop,
    onAddToChat: noop,
    onRemove: noop,
    ...overrides,
});

describe("HighlightActionBar", () => {
    const anchor = { left: 40, top: 200, bottom: 260 };

    it("names every action in words", () => {
        const html = renderToStaticMarkup(
            <HighlightActionBar anchor={anchor} {...handlers()} />,
        );
        expect(html).toContain('aria-label="Highlight actions"');
        expect(html).toContain("Copy with citation");
        expect(html).toContain("Add to chat");
        expect(html).toContain("Remove");
    });

    it("marks the highlight's current color as pressed", () => {
        const html = renderToStaticMarkup(
            <HighlightActionBar anchor={anchor} {...handlers({ color: "blue" })} />,
        );
        expect(html).toMatch(/aria-label="Blue highlight" aria-pressed="true"/);
        expect(html).toMatch(/aria-label="Pink highlight" aria-pressed="false"/);
    });

    it("says Copied after copying", () => {
        const html = renderToStaticMarkup(
            <HighlightActionBar anchor={anchor} {...handlers({ copied: true })} />,
        );
        expect(html).toContain("Copied");
        expect(html).not.toContain("Copy with citation");
    });

    it("sits above the highlight, or below it near the top of the paper", () => {
        const above = renderToStaticMarkup(
            <HighlightActionBar anchor={anchor} {...handlers()} />,
        );
        expect(above).toContain("top:200px");
        const below = renderToStaticMarkup(
            <HighlightActionBar
                anchor={{ left: 40, top: 10, bottom: 34 }}
                {...handlers()}
            />,
        );
        expect(below).toContain("top:34px");
    });
});

describe("HighlightActionSheet", () => {
    const base = {
        ...handlers({ color: "yellow" }),
        sectionTitle: "Methods",
        highlightCount: 3,
        onClose: noop,
    };

    it("titles the sheet with the color and says when it is saved", () => {
        const saved = renderToStaticMarkup(<HighlightActionSheet {...base} saved />);
        expect(saved).toContain("Highlighted in yellow");
        expect(saved).toContain("Methods · saved to this paper");
        const unsaved = renderToStaticMarkup(
            <HighlightActionSheet {...base} saved={false} />,
        );
        expect(unsaved).not.toContain("saved to this paper");
    });

    it("links to the highlights list only when there is one to open", () => {
        const withList = renderToStaticMarkup(
            <HighlightActionSheet {...base} saved onShowHighlights={noop} />,
        );
        expect(withList).toContain("Your highlights · 3");
        const without = renderToStaticMarkup(<HighlightActionSheet {...base} saved />);
        expect(without).not.toContain("Your highlights");
    });

    it("offers the same actions as the desktop bar", () => {
        const html = renderToStaticMarkup(<HighlightActionSheet {...base} saved />);
        expect(html).toContain("Copy with citation");
        expect(html).toContain("Add to chat");
        expect(html).toContain("Remove highlight");
        expect(html).toContain('aria-label="Close"');
    });
});

describe("HighlightHint", () => {
    it("shows the count against the per-paper limit only when highlights save", () => {
        expect(renderToStaticMarkup(<HighlightHint count={3} saved />)).toContain(
            "3 of 50",
        );
        expect(
            renderToStaticMarkup(<HighlightHint count={3} saved={false} />),
        ).not.toContain("of 50");
    });
});
