import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
    userFind: vi.fn(),
    userFindById: vi.fn(),
    countDocuments: vi.fn(async () => 0),
    aggregate: vi.fn(),
    create: vi.fn(),
    sendEmail: vi.fn(),
    recordAdminAction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/admin", () => ({
    withAdmin: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("../../../lib/admin-audit", () => ({ recordAdminAction: mocks.recordAdminAction }));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("../../../lib/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("../../../models/User", () => ({
    default: {
        find: mocks.userFind,
        findById: mocks.userFindById,
        countDocuments: mocks.countDocuments,
    },
}));
vi.mock("../../../models/AdminEmail", () => ({
    default: {
        aggregate: mocks.aggregate,
        create: mocks.create,
        find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
    },
}));

import { GET, POST } from "./route";

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", email: "admin@example.test" };
const PEOPLE = [
    { _id: "111111111111111111111111", email: "one@example.test" },
    { _id: "222222222222222222222222", email: "two@example.test" },
];
const ENV_KEYS = [
    "RESEND_API_KEY",
    "EMAIL_POSTAL_ADDRESS",
    "EMAIL_UNSUBSCRIBE_SECRET",
    "PRODUCT_EMAIL_DAILY_MAX",
    "PRODUCT_EMAIL_FROM",
    "APP_URL",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function post(body: unknown) {
    const request = new NextRequest("https://expansivemind.ai/api/admin/email", {
        method: "POST",
        headers: { origin: "https://expansivemind.ai", "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    request.user = ADMIN;
    return request;
}

function findReturns(people: typeof PEOPLE) {
    mocks.userFind.mockReturnValue({
        select: () => ({ limit: () => ({ lean: async () => people }) }),
    });
}

describe("/api/admin/email", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.RESEND_API_KEY = "test-key";
        process.env.EMAIL_POSTAL_ADDRESS = "PO Box 12, Boston, MA 02110";
        process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret";
        process.env.APP_URL = "https://expansivemind.ai";
        delete process.env.PRODUCT_EMAIL_DAILY_MAX;
        delete process.env.PRODUCT_EMAIL_FROM;
        mocks.aggregate.mockResolvedValue([]);
        mocks.sendEmail.mockResolvedValue({ accepted: true, status: 200, id: "e1" });
        findReturns(PEOPLE);
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    });

    it("sends group email to opted-in people only, even if an old client asks otherwise", async () => {
        const response = await POST(
            post({ audience: "free", subject: "News", body: "Hello", onlyOptedIn: false }),
        );
        expect(response.status).toBe(200);
        expect(mocks.userFind.mock.calls[0][0]).toMatchObject({ productEmailOptIn: true });
        expect(mocks.create.mock.calls[0][0]).toMatchObject({ onlyOptedIn: true });
    });

    it("sends from the newsletter address with the mailing address, unsubscribe, and replies to Meredith", async () => {
        await POST(post({ audience: "pro", subject: "News", body: "Hello" }));
        const mail = mocks.sendEmail.mock.calls[0][0];
        expect(mail.from).toBe("Expansive Mind <newsletter@expansivemind.ai>");
        expect(mail.replyTo).toBe("mernstaton@gmail.com");
        expect(mail.html).toContain("PO Box 12, Boston, MA 02110");
        expect(mail.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
        expect(mail.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/expansivemind\.ai\/api\/email\/unsubscribe\?token=/);
    });

    it("refuses group email until a mailing address is set", async () => {
        delete process.env.EMAIL_POSTAL_ADDRESS;
        const response = await POST(post({ audience: "pro", subject: "News", body: "Hello", test: true }));
        expect(response.status).toBe(400);
        expect((await response.json()).error).toMatch(/mailing address/);
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("refuses group email until unsubscribe links can be signed", async () => {
        delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
        const response = await POST(post({ audience: "pro", subject: "News", body: "Hello" }));
        expect(response.status).toBe(503);
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("stops at the daily cap so password resets still go out", async () => {
        process.env.PRODUCT_EMAIL_DAILY_MAX = "10";
        mocks.aggregate.mockResolvedValue([{ sent: 9 }]);
        const response = await POST(post({ audience: "free", subject: "News", body: "Hello" }));
        expect(response.status).toBe(400);
        expect((await response.json()).error).toMatch(/1 of today's 10/);
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("lets a note to one person through without the opt-in, but inside the cap", async () => {
        delete process.env.EMAIL_POSTAL_ADDRESS;
        mocks.userFindById.mockReturnValue({ select: () => ({ lean: async () => PEOPLE[0] }) });
        const response = await POST(
            post({ audience: "one", userId: PEOPLE[0]._id, subject: "Your account", body: "Hi" }),
        );
        expect(response.status).toBe(200);
        const mail = mocks.sendEmail.mock.calls[0][0];
        expect(mail.from).toBeUndefined();
        expect(mail.headers).toBeUndefined();
        expect(mail.html).not.toContain("Unsubscribe");
    });

    it("reports compliance status for the admin page", async () => {
        process.env.PRODUCT_EMAIL_DAILY_MAX = "40";
        mocks.aggregate.mockResolvedValue([{ sent: 15 }]);
        const response = await GET(post({}));
        const body = await response.json();
        expect(body.compliance).toEqual({
            postalAddressSet: true,
            postalAddress: "PO Box 12, Boston, MA 02110",
            unsubscribeReady: true,
            from: "Expansive Mind <newsletter@expansivemind.ai>",
            dailyMax: 40,
            sentToday: 15,
            remainingToday: 25,
        });
    });
});
