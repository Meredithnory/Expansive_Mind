import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminUserUsage } from "./AdminUserUsage";

const peoplePage = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "(protected)/people/page.tsx"),
    "utf8",
);

const apiUsage = [
    { feature: "discover", used: 2, limit: 5, period: "2026-09" },
    { feature: "search", used: 1, limit: 20, period: "2026-09" },
    { feature: "chat", used: 0, limit: 10, period: "2026-09" },
    { feature: "scholar_search", used: 0, limit: 3, period: "2026-09" },
    { feature: "projects", used: 1, limit: 2, period: "lifetime" },
];

describe("AdminUserUsage", () => {
    it("renders quota cells from the users API as text", () => {
        const html = renderToStaticMarkup(<AdminUserUsage usage={apiUsage} />);
        expect(html).toContain("Discovery: 2/5");
        expect(html).toContain("Searches: 1/20");
        expect(html).toContain("Scholar searches: 0/3");
        expect(html).toContain("Projects: 1/2");
        expect(html).not.toContain("[object Object]");
    });

    it("renders nothing when a user has no usage cells", () => {
        expect(renderToStaticMarkup(<AdminUserUsage usage={[]} />)).toBe("");
        expect(renderToStaticMarkup(<AdminUserUsage usage={null} />)).toBe("");
    });

    it("reads usage on the People page through the same cell parser", () => {
        expect(peoplePage).toContain("adminUsageCells(selected.usage)");
        expect(peoplePage).not.toContain("Object.entries(selected.usage)");
    });
});
