import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { hasValidMutationOrigin } from "./request-security";

const request = (headers: Record<string, string>) =>
    new NextRequest("https://expansive.example/api/projects", {
        method: "POST",
        headers,
    });

describe("hasValidMutationOrigin", () => {
    it("accepts the exact application origin", () => {
        expect(
            hasValidMutationOrigin(
                request({ origin: "https://expansive.example" }),
            ),
        ).toBe(true);
    });

    it("rejects cross-origin and unverifiable mutations", () => {
        expect(
            hasValidMutationOrigin(request({ origin: "https://other.example" })),
        ).toBe(false);
        expect(hasValidMutationOrigin(request({}))).toBe(false);
    });

    it("accepts same-origin Fetch Metadata when Origin is absent", () => {
        expect(
            hasValidMutationOrigin(
                request({ "sec-fetch-site": "same-origin" }),
            ),
        ).toBe(true);
    });
});
