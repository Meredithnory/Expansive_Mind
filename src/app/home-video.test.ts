import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

function sourceOrder(page: string): string[] {
    return [...page.matchAll(/<source\s+([^>]+)\/>/g)].map((match) => {
        const attrs = match[1];
        const src = attrs.match(/src="([^"]+)"/)?.[1] ?? "";
        const type = attrs.match(/type="([^"]+)"/)?.[1] ?? "";
        return `${src} ${type}`;
    });
}

describe("homepage DNA background sources", () => {
    it("lists a web-friendly HD mp4 before webm and never lists QuickTime", () => {
        const page = read("src/app/page.tsx");
        const sources = sourceOrder(page);

        expect(sources).toEqual([
            "/dnabg.mp4 video/mp4",
            "/dnabg.webm video/webm",
        ]);
        expect(page).toMatch(/poster="\/dnabg-poster\.jpg"/);
        expect(page).not.toMatch(/dnabg\.mov|video\/quicktime/i);
    });

    it("long-caches the served DNA files and drops the dead HD path", () => {
        const config = read("next.config.ts");
        const header = config.match(
            /source:\s*"\/:file\(([^"]+)\)"/,
        )?.[1];

        expect(header).toBe("dnabg.mp4|dnabg.webm|dnabg-poster.jpg");
        expect(config).not.toMatch(/dnabg-hd\.mp4|dnabg\.mov/);
    });
});
