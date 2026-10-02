import { describe, expect, it } from "vitest";
import { proAccessEmail } from "./pro-access-mail";

const allowance = { discover: 20, search: 300, scholar_search: 25, chat: 100, projects: 50 };

describe("Researcher Pro email", () => {
    it("says what they get, from the live numbers, with nothing to pay", () => {
        const mail = proAccessEmail({ origin: "https://expansivemind.ai", firstName: "Ada", email: "ada@lab.edu", allowance });
        expect(mail.subject).toBe("You have Researcher Pro on Expansive Mind, at no cost");
        expect(mail.text).toContain("Ada, you have Researcher Pro");
        expect(mail.text).toContain("20 discoveries");
        expect(mail.text).toContain("300 paper searches, including 25 on Google Scholar");
        expect(mail.text).toContain("100 paper assistant questions");
        expect(mail.text).toContain("sign in with ada@lab.edu");
        expect(mail.text).toContain("https://expansivemind.ai/discover");
        expect(mail.text).not.toMatch(/\$|price|billing|subscription/i);
        expect(mail.html).toContain("Complimentary access");
    });

    it("never echoes an odd name and escapes the address", () => {
        const mail = proAccessEmail({ origin: "https://expansivemind.ai", firstName: "www.spam.com", email: "<x>@lab.edu", allowance });
        expect(mail.text.split("\n")[0]).toBe("You have Researcher Pro");
        expect(mail.html).not.toContain("<x>@lab.edu");
    });
});
