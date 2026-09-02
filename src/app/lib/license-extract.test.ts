import { describe, expect, it } from "vitest";
import { extractLicenseFromJatsXml } from "./license-extract";

describe("extractLicenseFromJatsXml", () => {
    it("extracts a canonical ALI license reference", () => {
        const xml = `
            <article xmlns:ali="http://www.niso.org/schemas/ali/1.0/">
              <front><article-meta><permissions><license>
                <ali:license_ref>https://creativecommons.org/licenses/by/4.0/</ali:license_ref>
                <license-p>Creative Commons Attribution 4.0 International</license-p>
              </license></permissions></article-meta></front>
            </article>`;
        const rights = extractLicenseFromJatsXml(xml);
        expect(rights.licenseUrl).toBe(
            "https://creativecommons.org/licenses/by/4.0/",
        );
        expect(rights.rawLicense).toContain("Creative Commons Attribution");
    });

    it("returns unknown fields for missing permissions", () => {
        const rights = extractLicenseFromJatsXml("<article><front /></article>");
        expect(rights.rawLicense).toBeNull();
        expect(rights.licenseUrl).toBeNull();
    });
});
