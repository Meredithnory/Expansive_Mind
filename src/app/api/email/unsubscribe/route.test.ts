import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    updateOne: vi.fn(),
    consumeRateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    requestIp: () => "203.0.113.9",
}));
vi.mock("../../../models/User", () => ({ default: { updateOne: mocks.updateOne } }));

import { POST } from "./route";
import { unsubscribeToken } from "../../../lib/email-unsubscribe";

const USER = "0123456789abcdef01234567";

function oneClick(token: string) {
    // RFC 8058: the mail provider POSTs this body to the List-Unsubscribe URL.
    return new NextRequest(
        `https://expansivemind.ai/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
        {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "List-Unsubscribe=One-Click",
        },
    );
}

describe("POST /api/email/unsubscribe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret";
        mocks.consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    });

    it("honors a one-click unsubscribe even when the sender's IP is busy", async () => {
        const response = await POST(oneClick(unsubscribeToken(USER)));
        expect(response.status).toBe(200);
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
        const [filter, update] = mocks.updateOne.mock.calls[0];
        expect(filter).toEqual({ _id: USER });
        expect(update.$set.productEmailOptIn).toBe(false);
        expect(update.$set.productEmailOptOutAt).toBeInstanceOf(Date);
    });

    it("rate-limits only bad links", async () => {
        const blocked = await POST(oneClick(`${USER}.${"A".repeat(43)}`));
        expect(blocked.status).toBe(429);
        mocks.consumeRateLimit.mockResolvedValue({ allowed: true });
        const invalid = await POST(oneClick("nonsense"));
        expect(invalid.status).toBe(400);
        expect(mocks.updateOne).not.toHaveBeenCalled();
    });
});
