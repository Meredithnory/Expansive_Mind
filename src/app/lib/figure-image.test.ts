import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
    fetchFigureImage,
    MAX_FIGURE_PIXELS,
    validateFigureBytes,
    validateFigureSourceUrl,
} from "./figure-image";

const png = (width = 100, height = 50) => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
};

describe("figure image security", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("allows only configured HTTPS source hosts", () => {
        expect(
            validateFigureSourceUrl(
                "https://pmc-oa-opendata.s3.amazonaws.com/PMC1.1/gr1.jpg",
            ).hostname,
        ).toBe("pmc-oa-opendata.s3.amazonaws.com");
        expect(
            validateFigureSourceUrl(
                "https://cdn.ncbi.nlm.nih.gov/pmc/blobs/figure.png",
            ).hostname,
        ).toBe("cdn.ncbi.nlm.nih.gov");
        expect(
            validateFigureSourceUrl(
                "https://media.springernature.com/original/springer-static/image/art%3A10.1186%2Fs12917-015-0540-4/MediaObjects/fig.gif",
            ).hostname,
        ).toBe("media.springernature.com");
        expect(() =>
            validateFigureSourceUrl("http://cdn.ncbi.nlm.nih.gov/a.png"),
        ).toThrow(/not allowed/);
        expect(() =>
            validateFigureSourceUrl("https://127.0.0.1/a.png"),
        ).toThrow(/not allowed/);
        expect(() =>
            validateFigureSourceUrl("https://example.com/a.png"),
        ).toThrow(/not allowed/);
    });

    it("checks declared type, magic bytes, and image dimensions", () => {
        expect(validateFigureBytes(png(), "image/png")).toMatchObject({
            mimeType: "image/png",
            width: 100,
            height: 50,
        });
        expect(validateFigureBytes(png(), "binary/octet-stream")).toMatchObject({
            mimeType: "image/png",
        });
        expect(() => validateFigureBytes(png(), "image/jpeg")).toThrow(
            /does not match/,
        );
        expect(() =>
            validateFigureBytes(
                png(MAX_FIGURE_PIXELS + 1, 1),
                "image/png",
            ),
        ).toThrow(/dimensions/);
        expect(() =>
            validateFigureBytes(new Uint8Array([1, 2, 3])),
        ).toThrow(/supported/);
        const gif = new Uint8Array([
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x03, 0x00,
        ]);
        expect(validateFigureBytes(gif, "image/gif")).toMatchObject({
            mimeType: "image/gif",
            width: 2,
            height: 3,
        });
    });

    it("rejects redirects to hosts outside the allowlist", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(null, {
                status: 302,
                headers: { location: "https://example.com/private.png" },
            }),
        );
        await expect(
            fetchFigureImage(
                "https://pmc.ncbi.nlm.nih.gov/articles/PMC1/bin/f1.png",
            ),
        ).rejects.toThrow(/not allowed/);
    });
});
