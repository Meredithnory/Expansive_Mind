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
    it("keeps one OWNER-EDIT notice with a short visible label", () => {
        expect(SITE_STATUS.kind).toBe("beta");
        expect(SITE_STATUS.label).toBe("Beta");
        expect(SITE_STATUS.srLabel).toMatch(/still in testing/i);
    });

    it("is not mounted as a full-width strip above NavBar", () => {
        const layout = read("../layout.tsx");
        expect(layout).not.toMatch(/SiteStatus/);
        expect(() => read("./SiteStatus.tsx")).toThrow();
        expect(() => read("./styles/site-status.module.scss")).toThrow();
    });

    it("shows the beta chip next to the Expansive Mind wordmark", () => {
        const title = read("./Title.tsx");
        expect(title).toMatch(/SITE_STATUS/);
        expect(title).toMatch(/styles\.beta/);
        expect(title).toMatch(/SITE_STATUS\.label/);
        expect(title).toMatch(/SITE_STATUS\.srLabel/);
        expect(read("./NavBar.tsx")).toMatch(/<Title\s*\/>/);
    });

    it("leaves the homepage NavBar spacer in place", () => {
        const nav = read("./NavBar.tsx");
        expect(nav).toMatch(/pathname === "\/"/);
        expect(nav).toMatch(/homeSpacer/);
    });

    it("keeps the beta chip compact in title styles", () => {
        const scss = read("./styles/title.module.scss");
        expect(scss).toMatch(/\.beta\s*\{/);
        expect(scss).toMatch(/\$main-pink/);
        expect(scss).toMatch(/white-space:\s*nowrap/);
        expect(scss).not.toMatch(/position:\s*(fixed|sticky)/);
        expect(scss).not.toMatch(/100vw/);
        expect(scss).not.toMatch(/--mobile-bottom-nav-clearance/);
    });

    it("uses a three-row body grid without a status strip track", () => {
        expect(read("../globals.scss")).toMatch(
            /grid-template-rows:\s*auto\s+1fr\s+auto/,
        );
        expect(read("../globals.scss")).not.toMatch(
            /grid-template-rows:\s*auto\s+auto\s+1fr\s+auto/,
        );
    });
});
