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

    it("keeps the site status strip between homepage video and the navbar shell", () => {
        const stripZ = directZIndex(
            read("styles/site-status.module.scss"),
            ".strip",
        );
        const navZ = directZIndex(
            read("styles/navbar.module.scss"),
            ".navbarShell",
        );

        expect(stripZ).toBe(2);
        expect(stripZ).toBeGreaterThan(0);
        expect(navZ).not.toBeNull();
        expect(stripZ).toBeLessThan(navZ as number);
    });
});
