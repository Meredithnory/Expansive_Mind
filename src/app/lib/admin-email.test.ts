import { describe, expect, it } from "vitest";
import {
    PRODUCT_EMAIL_DAILY_MAX_DEFAULT,
    PRODUCT_EMAIL_FROM_DEFAULT,
    adminEmailBodyHtml,
    adminEmailContent,
    parseAdminEmailInput,
    productEmailSettings,
} from "./admin-email";

const USER = "a".repeat(24);

describe("parseAdminEmailInput", () => {
    it("requires an audience, a subject, and a body", () => {
        expect(parseAdminEmailInput({ audience: "everyone", subject: "Hi", body: "x" })).toMatchObject({ ok: false });
        expect(parseAdminEmailInput({ audience: "pro", subject: " ", body: "x" })).toMatchObject({ ok: false });
        expect(parseAdminEmailInput({ audience: "pro", subject: "Hi", body: "" })).toMatchObject({ ok: false });
        expect(parseAdminEmailInput({ audience: "one", subject: "Hi", body: "x" })).toMatchObject({
            ok: false,
            error: "Pick the person to email.",
        });
    });

    it("has no way to reach people who did not opt in", () => {
        const parsed = parseAdminEmailInput({ audience: "one", userId: USER, subject: "Hi\nthere", body: " Hello " });
        expect(parsed).toEqual({
            ok: true,
            value: { audience: "one", userId: USER, subject: "Hi there", body: "Hello", test: false },
        });
        // An old client's switch is ignored: group sends are opted-in only.
        const off = parseAdminEmailInput({ audience: "pro", subject: "Hi", body: "x", onlyOptedIn: false, test: true });
        expect(off.ok && "onlyOptedIn" in off.value).toBe(false);
        expect(off.ok && off.value.test).toBe(true);
    });
});

describe("adminEmailContent", () => {
    it("escapes the message and keeps its paragraphs", () => {
        expect(adminEmailBodyHtml("One <b>\nline\n\nTwo")).toBe("One &lt;b&gt;<br>line<br><br>Two");
    });

    it("adds an unsubscribe link only to group email", () => {
        const group = adminEmailContent({
            subject: "News",
            body: "Hello",
            origin: "https://expansivemind.ai",
            unsubscribeUrl: "https://expansivemind.ai/unsubscribe?token=t",
        });
        expect(group.html).toContain("Unsubscribe</a>");
        expect(group.text).toContain("Unsubscribe: https://expansivemind.ai/unsubscribe?token=t");
        const one = adminEmailContent({ subject: "Hi", body: "Hello", origin: "https://expansivemind.ai" });
        expect(one.html).not.toContain("Unsubscribe");
        expect(one.text).toContain("Reply to this email");
    });
});

describe("productEmailSettings", () => {
    it("defaults to the newsletter sender, no address, and a small daily cap", () => {
        expect(productEmailSettings({})).toEqual({
            postalAddress: null,
            from: PRODUCT_EMAIL_FROM_DEFAULT,
            dailyMax: PRODUCT_EMAIL_DAILY_MAX_DEFAULT,
        });
        expect(PRODUCT_EMAIL_DAILY_MAX_DEFAULT).toBeLessThan(100);
    });

    it("reads the address, sender, and cap, and ignores a bad cap", () => {
        expect(
            productEmailSettings({
                EMAIL_POSTAL_ADDRESS: " 123 Main St #456\nBoston, MA 02110 ",
                PRODUCT_EMAIL_FROM: "Expansive Mind <updates@expansivemind.ai>",
                PRODUCT_EMAIL_DAILY_MAX: "80",
            }),
        ).toEqual({
            postalAddress: "123 Main St #456 Boston, MA 02110",
            from: "Expansive Mind <updates@expansivemind.ai>",
            dailyMax: 80,
        });
        expect(productEmailSettings({ PRODUCT_EMAIL_DAILY_MAX: "lots" }).dailyMax).toBe(PRODUCT_EMAIL_DAILY_MAX_DEFAULT);
        expect(productEmailSettings({ PRODUCT_EMAIL_DAILY_MAX: "-5" }).dailyMax).toBe(PRODUCT_EMAIL_DAILY_MAX_DEFAULT);
    });
});

describe("group email footer", () => {
    it("carries the mailing address and the unsubscribe link", () => {
        const group = adminEmailContent({
            subject: "News",
            body: "Hello",
            origin: "https://expansivemind.ai",
            unsubscribeUrl: "https://expansivemind.ai/unsubscribe?token=t",
            postalAddress: "PO Box 12, Boston, MA 02110",
        });
        expect(group.html).toContain("PO Box 12, Boston, MA 02110");
        expect(group.text).toContain("PO Box 12, Boston, MA 02110");
        expect(group.html).toContain("newsletter and product updates");
    });
});
