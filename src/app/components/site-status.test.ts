import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SITE_STATUS } from "./site-status";

const here = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
    return readFileSync(join(here, relativePath), "utf8");
}

describe("site status chrome", () => {
    it("keeps one OWNER-EDIT notice", () => {
        expect(SITE_STATUS.kind).toBe("beta");
        expect(SITE_STATUS.label.trim().length).toBeGreaterThan(0);
        expect(SITE_STATUS.srLabel.trim().length).toBeGreaterThan(0);
    });

    it("is mounted from root layout, above NavBar, not inside it", () => {
        const layout = read("../layout.tsx");
        expect(layout).toMatch(/<SiteStatus/);
        expect(layout.indexOf("<SiteStatus")).toBeLessThan(
            layout.indexOf("<NavBar"),
        );
        expect(read("./NavBar.tsx")).not.toMatch(/SiteStatus|SITE_STATUS/);
    });

    it("leaves the homepage NavBar spacer in place", () => {
        const nav = read("./NavBar.tsx");
        expect(nav).toMatch(/pathname === "\/"/);
        expect(nav).toMatch(/homeSpacer/);
    });

    it("renders as a server component", () => {
        expect(read("./SiteStatus.tsx")).not.toMatch(/["']use client["']/);
    });

    it("does not sit in the mobile bottom-nav stack", () => {
        const scss = read("./styles/site-status.module.scss");
        expect(scss).not.toMatch(/position:\s*(fixed|sticky)/);
        expect(scss).not.toMatch(/(?<![\w-])bottom\s*:/);
        expect(scss).not.toMatch(/100vw/);
        expect(scss).not.toMatch(/--mobile-bottom-nav-clearance/);
        expect(scss).not.toMatch(/white-space:\s*nowrap/);
    });

    it("adds a body grid track for the strip", () => {
        expect(read("../globals.scss")).toMatch(
            /grid-template-rows:\s*auto\s+auto\s+1fr\s+auto/,
        );
    });

    it("reuses SITE_STATUS.label in the footer", () => {
        const footer = read("./Footer.tsx");
        expect(footer).toMatch(/import\s+\{\s*SITE_STATUS\s*\}/);
        expect(footer).toMatch(/SITE_STATUS\.label/);
    });
});
