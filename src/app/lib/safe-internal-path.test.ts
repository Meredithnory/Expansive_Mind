import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-internal-path";

describe("safeInternalPath", () => {
    it("allows same-origin relative paths used by login return flows", () => {
        expect(safeInternalPath("/discover")).toBe("/discover");
        expect(safeInternalPath("/pricing")).toBe("/pricing");
        expect(safeInternalPath("/pricing?intent=monthly")).toBe(
            "/pricing?intent=monthly",
        );
        expect(safeInternalPath("/shared/paper/abc-123")).toBe(
            "/shared/paper/abc-123",
        );
        expect(safeInternalPath("/savedpapers?tab=projects")).toBe(
            "/savedpapers?tab=projects",
        );
    });

    it("rejects open-redirect targets", () => {
        expect(safeInternalPath("https://evil.test")).toBe("/discover");
        expect(safeInternalPath("//evil.test")).toBe("/discover");
        expect(safeInternalPath("/\\evil.test")).toBe("/discover");
        expect(safeInternalPath("\\\\evil.test")).toBe("/discover");
        expect(safeInternalPath("/%2F%2Fevil.test")).toBe("/discover");
        expect(safeInternalPath("javascript:alert(1)")).toBe("/discover");
        expect(safeInternalPath("")).toBe("/discover");
        expect(safeInternalPath(null)).toBe("/discover");
        // Same-origin path that merely looks like a URL stays on-site (not an open redirect).
        expect(safeInternalPath("/https://evil.test")).toBe("/https://evil.test");
    });

    it("uses a custom fallback when provided", () => {
        expect(safeInternalPath("//evil.test", "/pricing")).toBe("/pricing");
    });
});
