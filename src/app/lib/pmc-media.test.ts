import { describe, expect, it } from "vitest";
import {
    buildPmcMediaLookup,
    resolvePmcMediaUrl,
    s3MediaToHttps,
} from "./pmc-media";

describe("pmc media lookup", () => {
    it("converts open-data S3 URLs to HTTPS object URLs", () => {
        expect(
            s3MediaToHttps(
                "s3://pmc-oa-opendata/PMC5388087.1/gr1.jpg?md5=abc",
            ),
        ).toBe(
            "https://pmc-oa-opendata.s3.amazonaws.com/PMC5388087.1/gr1.jpg",
        );
    });

    it("resolves JATS graphic hrefs, including extensionless stems", () => {
        const lookup = buildPmcMediaLookup([
            "s3://pmc-oa-opendata/PMC1.1/gr1.jpg?md5=1",
            "s3://pmc-oa-opendata/PMC1.1/mmc1.pdf?md5=2",
        ]);
        expect(resolvePmcMediaUrl("gr1.jpg", lookup)).toContain("/gr1.jpg");
        expect(resolvePmcMediaUrl("gr1", lookup)).toContain("/gr1.jpg");
        expect(resolvePmcMediaUrl("folder/GR1.JPG", lookup)).toContain(
            "/gr1.jpg",
        );
        expect(resolvePmcMediaUrl("mmc1.pdf", lookup)).toBe("");
    });
});
