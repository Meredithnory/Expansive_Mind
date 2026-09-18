import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
    return readFileSync(join(here, relativePath), "utf8");
}

function mediaBodies(scss: string): string[] {
    const bodies: string[] = [];
    const needle = "@media";
    let from = 0;
    while (from < scss.length) {
        const start = scss.indexOf(needle, from);
        if (start === -1) break;
        const brace = scss.indexOf("{", start);
        if (brace === -1) break;
        const query = scss.slice(start, brace);
        const maxWidth = query.match(/max-width:\s*(\d+)px/);
        let depth = 0;
        let body = "";
        for (let i = brace; i < scss.length; i += 1) {
            const ch = scss[i];
            if (ch === "{") {
                depth += 1;
                if (depth > 1) body += ch;
                continue;
            }
            if (ch === "}") {
                depth -= 1;
                if (depth === 0) {
        if (maxWidth && Number(maxWidth[1]) <= 720) {
            bodies.push(body);
        }
                    from = i + 1;
                    break;
                }
                body += ch;
                continue;
            }
            if (depth >= 1) body += ch;
        }
    }
    return bodies;
}

function phoneCss(...files: string[]) {
    return files.flatMap((file) => mediaBodies(read(file))).join("\n");
}

describe("admin phone layout", () => {
    const adminPhone = phoneCss("admin.module.scss");
    const usagePhone = phoneCss("usage/usage.module.scss");

    it("covers a 390px phone without a second 32px page inset", () => {
        expect(adminPhone).toMatch(/\.page[\s\S]*width:\s*100%/);
        expect(usagePhone).toMatch(/\.page[\s\S]*width:\s*100%/);
    });

    it("gives owner controls a 44px tap target on phone", () => {
        expect(adminPhone).toMatch(/min-height:\s*44px/);
    });

    it("keeps wide tables inside a scroll region with a visible horizontal scrollbar", () => {
        const admin = read("admin.module.scss");
        expect(admin).toMatch(/\.tableScroll/);
        expect(adminPhone).toMatch(/\.tableScroll[\s\S]*overflow-x:\s*auto/);
        expect(adminPhone).toMatch(/\.tableScroll[\s\S]*::-webkit-scrollbar[\s\S]*height:\s*[1-9]/);
    });

    it("stacks the users table into cards so support actions stay on screen", () => {
        expect(adminPhone).toMatch(/\.stackOnPhone/);
        expect(adminPhone).toMatch(/\.stackOnPhone[\s\S]*display:\s*block/);
    });

    it("drops the usage definition list from four columns on phone", () => {
        expect(usagePhone).toMatch(/dl[\s\S]*grid-template-columns:\s*(repeat\([12]|1fr)/);
        expect(usagePhone).not.toMatch(/dl[\s\S]*grid-template-columns:\s*repeat\(4/);
    });
});
