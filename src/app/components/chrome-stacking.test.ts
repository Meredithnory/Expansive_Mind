import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
    return readFileSync(join(here, relativePath), "utf8");
}

function directZIndex(scss: string, selector: string): number | null {
    const start = scss.indexOf(`${selector} {`);
    if (start === -1) {
        throw new Error(`missing ${selector} rule`);
    }

    let depth = 0;
    let body = "";
    for (let i = start; i < scss.length; i += 1) {
        const ch = scss[i];
        if (ch === "{") {
            depth += 1;
            continue;
        }
        if (ch === "}") {
            depth -= 1;
            if (depth === 0) break;
            continue;
        }
        if (depth === 1) body += ch;
    }

    const match = body.match(/z-index:\s*(-?\d+)\s*;/);
    return match ? Number(match[1]) : null;
}

describe("mobile chrome stacking", () => {
    it("keeps the footer from stacking above the navbar shell", () => {
        const footerZ = directZIndex(
            read("styles/footer.module.scss"),
            ".footer",
        );
        const navZ = directZIndex(
            read("styles/navbar.module.scss"),
            ".navbarShell",
        );

        expect(navZ).not.toBeNull();
        expect(footerZ ?? 0).toBeLessThan(navZ as number);
    });

    it("does not keep a site status strip in the chrome stack", () => {
        expect(() => read("styles/site-status.module.scss")).toThrow();
        const navZ = directZIndex(
            read("styles/navbar.module.scss"),
            ".navbarShell",
        );

        expect(navZ).not.toBeNull();
        expect(navZ as number).toBeGreaterThan(0);
    });

    it("lets the footer sit after content instead of on the bottom nav", () => {
        const globals = read("../globals.scss");
        const start = globals.indexOf("@media (max-width: 720px)");
        expect(start).toBeGreaterThan(-1);
        const body = globals.slice(start, start + 1800);
        expect(body).toMatch(/grid-template-rows:\s*auto\s+auto\s+auto/);
        expect(body).not.toMatch(
            /grid-template-rows:\s*auto\s+auto\s+auto\s+auto/,
        );
        expect(body).not.toMatch(
            /grid-template-rows:\s*auto\s+auto\s+1fr\s+auto/,
        );
        expect(body).toMatch(/min-height:\s*0/);
        expect(body).toMatch(
            /scroll-padding-bottom:\s*var\(--mobile-bottom-nav-clearance\)/,
        );
    });

    it("keeps the phone research column above the legal footer", () => {
        const globals = read("../globals.scss");
        const start = globals.indexOf("The nav is position:fixed");
        expect(start).toBeGreaterThan(-1);
        const body = globals.slice(start, start + 1200);
        expect(body).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/);
        expect(body).not.toMatch(/grid-template-rows:\s*auto\s+1fr\s+auto/);
        expect(body).toMatch(/\.main-content\s*\{[^}]*grid-row:\s*1/);
        expect(body).toMatch(/\[data-app-footer\]\s*\{[^}]*grid-row:\s*2/);
    });

    it("lets a vertical swipe on a source rail scroll the page", () => {
        const carousel = read("../discover/source-logo-carousel.module.scss");
        const chips = read("styles/databasemind.module.scss");
        expect(carousel).toMatch(/touch-action:\s*pan-x\s+pan-y\s*;/);
        expect(chips).toMatch(/touch-action:\s*pan-x\s+pan-y\s*;/);
        expect(carousel).not.toMatch(/touch-action:\s*pan-x\s*;/);
        expect(chips).not.toMatch(/touch-action:\s*pan-x\s*;/);
    });

    it("keeps phone footer links on one wrapping row", () => {
        const footer = read("styles/footer.module.scss");
        const start = footer.indexOf("@media (max-width: 720px)");
        expect(start).toBeGreaterThan(-1);
        const body = footer.slice(start);
        expect(body).toMatch(/\.links\s*\{[^}]*flex-direction:\s*row/);
    });

    it("keeps the search scroll-to-top control above the bottom nav", () => {
        const scss = read("../searchpaper/searchpaper.module.scss");
        const rule = scss.slice(scss.lastIndexOf(".scrollTopButton"));
        expect(rule).toMatch(
            /bottom:\s*calc\(\s*var\(--mobile-bottom-nav-clearance\)\s*\+\s*12px\s*\)/,
        );
        expect(rule).not.toMatch(
            /bottom:\s*max\(16px,\s*env\(safe-area-inset-bottom\)\)/,
        );
    });
});
