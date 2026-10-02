import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "64b000000000000000000001";
const mocks = vi.hoisted(() => ({
    findOneAndUpdate: vi.fn(),
    sendEmail: vi.fn(),
    limit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({ withAuth: (handler: unknown) => handler }));
vi.mock("../../../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../../../lib/rate-limit", () => ({ consumeRateLimit: mocks.limit }));
vi.mock("../../../lib/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("../../../lib/plan-config", () => ({
    getPlanEntitlements: () => Promise.resolve({ discover: 5, search: 20, chat: 30 }),
    resolvePlan: () => "free",
}));
vi.mock("../../../models/LimitAlert", () => ({ default: { findOneAndUpdate: mocks.findOneAndUpdate } }));

import { POST } from "./route";
import { DEVELOPER_EMAIL } from "../../../lib/contact";

function request(body: unknown) {
    const next = new NextRequest("https://expansivemind.ai/api/limits/request", {
        method: "POST",
        headers: { origin: "https://expansivemind.ai", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    next.user = { _id: { toString: () => USER_ID }, firstName: "Ada", lastName: "Lovelace", email: "ada@lab.edu" };
    return next;
}

const row = (value: unknown) => ({ lean: () => Promise.resolve(value) });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.sendEmail.mockResolvedValue({ accepted: true, status: 200, id: "e1" });
    mocks.findOneAndUpdate.mockReturnValue(row({ used: 5, limit: 5 }));
});

describe("POST /api/limits/request", () => {
    it("marks this month's limit and emails Meredith, with replies going to them", async () => {
        const response = await POST(request({ feature: "discover", note: "Writing an R01 on GLP-1 and addiction." }));
        expect(await response.json()).toEqual({ ok: true, emailed: true });
        const [filter, update, options] = mocks.findOneAndUpdate.mock.calls[0];
        expect(filter._id).toMatch(new RegExp(`^${USER_ID}:discover:\\d{4}-\\d{2}$`));
        expect(update.$set).toMatchObject({ requestNote: "Writing an R01 on GLP-1 and addiction." });
        expect(update.$set.requestedAt).toBeInstanceOf(Date);
        expect(options).toEqual({ upsert: true, new: false });
        const mail = mocks.sendEmail.mock.calls[0][0];
        expect(mail).toMatchObject({ to: DEVELOPER_EMAIL, replyTo: "ada@lab.edu" });
        expect(mail.subject).toMatch(/^Ada Lovelace asked for more discoveries · /);
        expect(mail.text).toContain("Writing an R01 on GLP-1 and addiction.");
        expect(mail.text).toContain("Discoveries: 5 of 5");
    });

    it("emails only once a month per allowance", async () => {
        mocks.findOneAndUpdate.mockReturnValue(row({ used: 5, limit: 5, requestedAt: new Date() }));
        const response = await POST(request({ feature: "discover" }));
        expect(await response.json()).toEqual({ ok: true, already: true });
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("needs a real allowance and stops floods", async () => {
        expect((await POST(request({ feature: "projects" }))).status).toBe(400);
        mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
        expect((await POST(request({ feature: "discover" }))).status).toBe(429);
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
});
