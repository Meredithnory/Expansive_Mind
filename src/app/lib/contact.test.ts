import { describe, expect, it } from "vitest";
import {
    CONTACT_TOPICS,
    DEVELOPER_EMAIL,
    contactMailto,
    parseContactFields,
} from "./contact";

describe("parseContactFields", () => {
    const valid = {
        name: "Ada Lovelace",
        email: "ada@university.edu",
        topic: "Question" as const,
        message: "How does paper chat use the source text?",
    };

    it("accepts a complete note", () => {
        const parsed = parseContactFields(valid);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.spam).toBe(false);
            expect(parsed.fields.email).toBe("ada@university.edu");
        }
    });

    it("silently flags honeypot submissions", () => {
        const parsed = parseContactFields({ ...valid, website: "https://spam.test" });
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.spam).toBe(true);
    });

    it("rejects a missing message", () => {
        const parsed = parseContactFields({ ...valid, message: "Hi" });
        expect(parsed).toMatchObject({ ok: false });
    });

    it("rejects an unknown topic", () => {
        const parsed = parseContactFields({ ...valid, topic: "Sales" });
        expect(parsed).toMatchObject({ ok: false });
    });
});

describe("contactMailto", () => {
    it("addresses Meredith's inbox", () => {
        const href = contactMailto({
            name: "Ada",
            email: "ada@university.edu",
            topic: CONTACT_TOPICS[0],
            message: "Hello from the lab.",
        });
        expect(href.startsWith(`mailto:${DEVELOPER_EMAIL}?`)).toBe(true);
        expect(href).toContain(encodeURIComponent("Expansive Mind — Question"));
    });
});
