import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendPasswordResetEmail } from "./password-reset-mail";

const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.CONTACT_FROM_EMAIL;
const link = "https://example.test/reset-password?token=once";

describe("sendPasswordResetEmail", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        if (originalKey === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = originalKey;
        if (originalFrom === undefined) delete process.env.CONTACT_FROM_EMAIL;
        else process.env.CONTACT_FROM_EMAIL = originalFrom;
    });

    it("does not call Resend when the API key is missing", async () => {
        delete process.env.RESEND_API_KEY;
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const result = await sendPasswordResetEmail({
            to: "ada@example.com",
            link,
        });

        expect(result).toEqual({ accepted: false, status: null, id: null });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends one themed message and records provider acceptance", async () => {
        process.env.RESEND_API_KEY = "test-key";
        process.env.CONTACT_FROM_EMAIL = "Expansive Mind <hi@example.com>";
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: "email_123" }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await sendPasswordResetEmail({
            to: "ada@example.com",
            link,
        });

        expect(result).toEqual({
            accepted: true,
            status: 200,
            id: "email_123",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.resend.com/emails");
        expect(init.method).toBe("POST");
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer test-key");
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({
            from: "Expansive Mind <hi@example.com>",
            to: ["ada@example.com"],
            subject: "Reset your Expansive Mind password",
        });
        expect(body.html).toContain("#ff0084");
        expect(body.html).toContain("#000000");
        expect(body.html).toContain("Manrope");
        expect(body.text).toContain(link);
        expect(body.html).toContain(link);
        expect(JSON.stringify(body)).not.toMatch(/password is/i);
    });

    it("reports a provider rejection without treating it as sent", async () => {
        process.env.RESEND_API_KEY = "test-key";
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ message: "rejected" }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await sendPasswordResetEmail({
            to: "ada@example.com",
            link,
        });

        expect(result).toEqual({ accepted: false, status: 422, id: null });
    });
});
