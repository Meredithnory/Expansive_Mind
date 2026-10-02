import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    updateOne: vi.fn(),
    findById: vi.fn(),
    sendEmail: vi.fn(),
    after: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("../db/connectDB", () => ({ default: vi.fn() }));
vi.mock("../models/LimitAlert", () => ({ default: { updateOne: mocks.updateOne } }));
vi.mock("../models/User", () => ({ default: { findById: mocks.findById } }));
vi.mock("./send-email", () => ({ sendEmail: mocks.sendEmail }));

import { recordLimitAlert, scheduleLimitAlert } from "./limit-alerts";
import { limitAlertEmail } from "./limit-alert-mail";
import { DEVELOPER_EMAIL } from "./contact";

const USER = "0123456789abcdef01234567";
const reached = { userID: USER, feature: "discover", period: "2026-10", limit: 5, used: 5, blocked: false };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mocks.findById.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ firstName: "Ada", lastName: "Lovelace", email: "ada@lab.edu" }) }),
    });
    mocks.sendEmail.mockResolvedValue({ accepted: true, status: 200, id: "e1" });
});

describe("limit alerts", () => {
    it("emails Meredith the first time someone uses up an allowance in a month", async () => {
        await recordLimitAlert(reached, new Date("2026-10-14T18:00:00.000Z"));
        const [filter, update, options] = mocks.updateOne.mock.calls[0];
        expect(filter).toEqual({ _id: `${USER}:discover:2026-10` });
        expect(update.$setOnInsert).toMatchObject({ userID: USER, feature: "discover", period: "2026-10" });
        expect(update.$max).toEqual({ used: 5 });
        expect(options).toEqual({ upsert: true });

        const mail = mocks.sendEmail.mock.calls[0][0];
        expect(mail).toMatchObject({ to: DEVELOPER_EMAIL, replyTo: "ada@lab.edu" });
        expect(mail.subject).toBe("Ada Lovelace used all 5 discoveries · Oct 2026");
        expect(mail.text).toContain("/admin/people?q=ada%40lab.edu");
        expect(mocks.updateOne).toHaveBeenLastCalledWith({ _id: `${USER}:discover:2026-10` }, { $set: { emailed: true } });
    });

    it("only updates the row on later hits that month, and marks a retry", async () => {
        mocks.updateOne.mockResolvedValue({ upsertedCount: 0 });
        await recordLimitAlert({ ...reached, used: 5, blocked: true });
        expect(mocks.updateOne.mock.calls[0][1].$set).toMatchObject({ blocked: true });
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("leaves projects, Scholar, and lifetime counters alone", () => {
        scheduleLimitAlert({ ...reached, feature: "projects" });
        scheduleLimitAlert({ ...reached, feature: "scholar_search" });
        scheduleLimitAlert({ ...reached, period: "lifetime" });
        expect(mocks.after).not.toHaveBeenCalled();
        scheduleLimitAlert(reached);
        expect(mocks.after).toHaveBeenCalledTimes(1);
    });

    it("never throws when the email or database fails", async () => {
        mocks.updateOne.mockRejectedValueOnce(new Error("db down"));
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(recordLimitAlert(reached)).resolves.toBeUndefined();
        log.mockRestore();
    });
});

describe("limit alert email", () => {
    it("escapes the name and links to the person in admin", () => {
        const mail = limitAlertEmail({
            origin: "https://expansivemind.ai",
            name: "<b>Ada</b>",
            email: "ada@lab.edu",
            feature: "search",
            used: 20,
            limit: 20,
            period: "2026-10",
        });
        expect(mail.html).not.toContain("<b>Ada</b>");
        expect(mail.html).toContain("https://expansivemind.ai/admin/people?q=ada%40lab.edu");
        expect(mail.text).toContain("Paper searches: 20 of 20");
    });
});
