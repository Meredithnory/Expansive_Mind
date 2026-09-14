import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createPrivateTranscription = vi.hoisted(() => vi.fn());

vi.mock("../authMiddleware", () => ({
    withOptionalAuth: (handler: unknown) => handler,
}));
vi.mock("../../lib/rate-limit", () => ({
    consumeRateLimit: async () => ({ allowed: true }),
    requestIp: () => "test-ip",
}));
vi.mock("../../lib/request-security", async () => {
    const actual = await vi.importActual<
        typeof import("../../lib/request-security")
    >("../../lib/request-security");
    return { ...actual, hasValidMutationOrigin: () => true };
});
vi.mock("../openrouter", () => ({ createPrivateTranscription }));

import { POST } from "./route";

beforeEach(() => {
    createPrivateTranscription.mockReset();
    createPrivateTranscription.mockResolvedValue("GLP-1 outcomes in CKD");
});

const request = (body: unknown) =>
    new NextRequest("http://localhost:3000/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

describe("voice transcription", () => {
    it("returns transcribed text", async () => {
        const response = await POST(request({ audio: "UklGRiQA", format: "webm" }));
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            text: "GLP-1 outcomes in CKD",
        });
        expect(createPrivateTranscription).toHaveBeenCalledWith(
            expect.objectContaining({
                audioBase64: "UklGRiQA",
                format: "webm",
            }),
            expect.objectContaining({ feature: "discover" }),
        );
    });

    it("rejects unsupported audio before calling the model", async () => {
        const response = await POST(request({ audio: "UklGRiQA", format: "exe" }));
        expect(response.status).toBe(400);
        expect(createPrivateTranscription).not.toHaveBeenCalled();
    });
});
