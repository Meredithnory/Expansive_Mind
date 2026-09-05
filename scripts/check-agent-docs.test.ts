import { describe, expect, it } from "vitest";
import { checkAgentDocs, extractDocumentedPaths } from "./check-agent-docs.mjs";

describe("agent docs checker", () => {
    it("extracts repo paths from markdown", () => {
        expect(
            extractDocumentedPaths(
                "See `src/app/lib/entitlements.ts` and `AGENTS.md`. Ignore https://example.com/src/nope.",
            ),
        ).toEqual(["src/app/lib/entitlements.ts", "AGENTS.md"]);
    });

    it("confirms documented agent-os paths exist", () => {
        const result = checkAgentDocs();
        expect(result.missingDocs).toEqual([]);
        expect(result.missingRequired).toEqual([]);
        expect(result.missingDocumented).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.documentedCount).toBeGreaterThan(20);
    });
});
