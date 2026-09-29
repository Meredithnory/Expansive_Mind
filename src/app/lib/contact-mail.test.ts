import { describe, expect, it } from "vitest";
import {
    contactConfirmationEmail,
    contactNotificationEmail,
    greetingName,
} from "./contact-mail";
import { DEFAULT_FROM_ADDRESS, emailFromAddress } from "./email-layout";

const fields = {
    name: "Ada Lovelace",
    email: "ada@university.edu",
    topic: "Feedback" as const,
    message: "Loved it.\n<script>alert(1)</script> & more",
};
const origin = "https://expansivemind.ai";

describe("contact notification to Meredith", () => {
    it("escapes what the sender typed and keeps their line breaks", () => {
        const mail = contactNotificationEmail(fields, { origin, sentAt: new Date("2026-09-28T14:42:00Z") });
        expect(mail.subject).toBe("New message · Feedback · from Ada Lovelace");
        expect(mail.html).not.toContain("<script>");
        expect(mail.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; more");
        expect(mail.html).toContain("white-space:pre-wrap");
        expect(mail.html).toContain("Reply to Ada");
        expect(mail.html).toContain(`${origin}/email/brainlogo.png`);
        expect(mail.text).toContain("From: Ada Lovelace <ada@university.edu>");
        expect(mail.text).toContain("Loved it.\n<script>");
    });

    it("keeps the subject on one line", () => {
        const mail = contactNotificationEmail({ ...fields, name: "Ada\r\nBcc: x@evil.test" }, { origin });
        expect(mail.subject).not.toMatch(/[\r\n]/);
    });
});

describe("\"we got your message\" reply", () => {
    it("greets by first name and never repeats the message", () => {
        const mail = contactConfirmationEmail(fields, { origin });
        expect(mail.subject).toBe("We got your message");
        expect(mail.html).toContain("Thanks, Ada. We got your note.");
        expect(mail.html).not.toContain("Loved it");
        expect(mail.text).not.toContain("Loved it");
        expect(mail.html).toContain("If that wasn&#39;t you, you can ignore this email.");
    });

    it("drops a name that could carry a link or a pitch", () => {
        expect(greetingName("Ada Lovelace")).toBe("Ada");
        expect(greetingName("Zoë O’Neil")).toBe("Zoë");
        expect(greetingName("http://spam.example buy now")).toBeNull();
        expect(greetingName("www.spam.example")).toBe(null);
        const mail = contactConfirmationEmail({ name: "visit-spam.example/now" }, { origin });
        expect(mail.html).toContain("Thanks. We got your note.");
        expect(mail.html).not.toContain("spam");
    });
});

describe("sender address", () => {
    it("defaults to support@ and lets CONTACT_FROM_EMAIL override it", () => {
        expect(DEFAULT_FROM_ADDRESS).toBe("Expansive Mind <support@expansivemind.ai>");
        expect(emailFromAddress({})).toBe(DEFAULT_FROM_ADDRESS);
        expect(emailFromAddress({ CONTACT_FROM_EMAIL: "Team <hi@example.com>" })).toBe("Team <hi@example.com>");
    });
});

describe("contact email colors", () => {
    it("keeps the sender's details and message readable on the light default", () => {
        const mail = contactNotificationEmail(fields, { origin: "https://expansivemind.ai" });
        expect(mail.html).not.toMatch(/color:#(?:e6eef8|f2f7ff)/i);
        expect(mail.html).toContain('class="em-heading"');
    });
});
