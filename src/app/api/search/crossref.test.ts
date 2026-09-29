import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
    process.env.NCBI_EMAIL = "contact@example.com";
});
vi.mock("server-only", () => ({}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: vi.fn(async () => ({ allowed: true })),
}));

import { searchCrossrefPapers } from "./utils";

describe("searchCrossrefPapers", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("sends a contact address so Crossref uses its polite pool", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const fetch = vi.fn(async (_input: RequestInfo | URL) =>
            Response.json({ message: { items: [], "total-results": 0 } }),
        );
        vi.stubGlobal("fetch", fetch);
        await searchCrossrefPapers("lipidomics");
        const url = new URL(String(fetch.mock.calls[0][0]));
        expect(url.searchParams.get("mailto")).toBe("contact@example.com");
    });
});
