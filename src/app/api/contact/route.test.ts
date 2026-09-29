import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ send: vi.fn(), limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/send-email", () => ({ sendEmail: mocks.send }));
vi.mock("../../lib/rate-limit", () => ({ consumeRateLimit: mocks.limit, requestIp: () => "1.2.3.4" }));
vi.mock("../../lib/request-security", () => ({
    hasValidMutationOrigin: () => true,
    trustedApplicationOrigin: () => "https://expansivemind.ai",
}));

import { POST } from "./route";

const body = { name: "Ada Lovelace", email: "ada@university.edu", topic: "Question", message: "Hello there, a quick question." };
const request = (data: unknown) =>
    new NextRequest("https://expansivemind.ai/api/contact", { method: "POST", body: JSON.stringify(data) });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.send.mockResolvedValue({ accepted: true, status: 200, id: "e1" });
});

describe("POST /api/contact", () => {
    it("emails Meredith, then sends the sender a short reply", async () => {
        const response = await POST(request(body));
        expect((await response.json()).delivered).toBe("inbox");
        expect(mocks.send).toHaveBeenCalledTimes(2);
        const [toMeredith, toSender] = mocks.send.mock.calls.map((call) => call[0]);
        expect(toMeredith).toMatchObject({ replyTo: "ada@university.edu", subject: "New message · Question · from Ada Lovelace" });
        expect(toSender).toMatchObject({ to: "ada@university.edu", subject: "We got your message" });
        expect(toSender.html).not.toContain("a quick question");
    });

    it("skips the reply when Meredith's copy was not accepted", async () => {
        mocks.send.mockResolvedValueOnce({ accepted: false, status: 500, id: null });
        const response = await POST(request(body));
        expect((await response.json()).delivered).toBe("mailto");
        expect(mocks.send).toHaveBeenCalledTimes(1);
    });

    it("sends at most a couple of replies a day to one address", async () => {
        mocks.limit
            .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 })
            .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 });
        await POST(request(body));
        expect(mocks.send).toHaveBeenCalledTimes(1);
        expect(mocks.limit).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "contact-confirm", identity: "ada@university.edu" }));
    });

    it("sends nothing for the spam trap", async () => {
        await POST(request({ ...body, website: "http://spam.example" }));
        expect(mocks.send).not.toHaveBeenCalled();
    });
});
