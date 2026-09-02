import { describe, expect, it } from "vitest";
import { requestIp } from "./request-ip";

function requestWith(headers: Record<string, string>, ip?: string) {
    const request = new Request("https://example.com/api/discover", {
        headers,
    });
    if (ip) Object.assign(request, { ip });
    return request;
}

describe("requestIp", () => {
    it("uses the platform-observed IP instead of a spoofed forwarded header", () => {
        expect(
            requestIp(
                requestWith({
                    "x-forwarded-for": "8.8.8.8, 1.2.3.4",
                    "x-vercel-forwarded-for": "203.0.113.10",
                }),
            ),
        ).toBe("203.0.113.10");
    });

    it("does not trust X-Forwarded-For alone", () => {
        expect(
            requestIp(
                requestWith({
                    "x-forwarded-for": "198.51.100.1",
                }),
            ),
        ).toBe("unknown");
    });

    it("falls back to the platform IP when proxy headers are absent", () => {
        expect(requestIp(requestWith({}, "10.0.0.8"))).toBe("10.0.0.8");
    });
});
