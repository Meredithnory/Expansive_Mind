import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseUnpaywallRecord } from "./unpaywall";

describe("parseUnpaywallRecord", () => {
    it("copies best OA location fields without inventing a license", () => {
        expect(
            parseUnpaywallRecord(
                {
                    best_oa_location: {
                        url: "https://example.org/article",
                        url_for_pdf: "https://example.org/article.pdf",
                        license: "cc-by",
                        version: "publishedVersion",
                        host_type: "publisher",
                    },
                },
                "10.1000/x",
            ),
        ).toEqual({
            doi: "10.1000/x",
            bestUrl: "https://example.org/article",
            pdfUrl: "https://example.org/article.pdf",
            rawLicense: "cc-by",
            licenseUrl: "cc-by",
            version: "publishedVersion",
            hostType: "publisher",
        });
    });
});
