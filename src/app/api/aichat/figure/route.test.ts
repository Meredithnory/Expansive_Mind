import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    resolvePlan: vi.fn(),
    consumeQuota: vi.fn(),
    refundQuota: vi.fn(),
    loadCachedPaperBySource: vi.fn(),
    validateFigureBytes: vi.fn(),
    respondToFigure: vi.fn(),
    findSavedPaperForUser: vi.fn(),
    messageCreate: vi.fn(),
}));

vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: unknown) => handler,
}));
vi.mock("../../../lib/request-security", () => ({
    hasValidMutationOrigin: () => true,
}));
vi.mock("../../../lib/rate-limit", () => ({
    consumeRateLimit: () =>
        Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock("../../../lib/entitlements", () => ({
    resolvePlan: mocks.resolvePlan,
    consumeQuota: mocks.consumeQuota,
    refundQuota: mocks.refundQuota,
}));
vi.mock("../../../lib/admin", () => ({ isAdminUser: () => false }));
vi.mock("../../../lib/paper-sources", () => ({
    getSourceByDatabase: (database: string) =>
        database === "nih"
            ? { database: "nih", label: "NIH", defaultIdName: "pmcid" }
            : null,
    normalizeStoredPaperId: (id: string) => id,
}));
vi.mock("../../paper/load-paper", () => ({
    loadCachedPaperBySource: mocks.loadCachedPaperBySource,
}));
vi.mock("../../../lib/figure-image", () => ({
    MAX_FIGURE_BYTES: 5 * 1024 * 1024,
    validateFigureBytes: mocks.validateFigureBytes,
    fetchFigureImage: vi.fn(),
    figureImageDataUrl: () => "data:image/png;base64,test",
}));
vi.mock("../../../lib/figure-context", () => ({
    findPaperFigure: vi.fn(),
    buildFigureContext: () => "Paper title: Example",
}));
vi.mock("../../figure-chat", () => ({
    respondToFigure: mocks.respondToFigure,
}));
vi.mock("../../../lib/saved-paper-utils", () => ({
    findSavedPaperForUser: mocks.findSavedPaperForUser,
}));
vi.mock("../../../models/SavedPaper", () => ({
    default: { findOneAndUpdate: vi.fn() },
}));
vi.mock("../../../models/Message", () => ({
    default: {
        find: () => ({
            sort: () => ({
                limit: () => ({ lean: () => Promise.resolve([]) }),
            }),
        }),
        create: mocks.messageCreate,
    },
}));

import { POST } from "./route";
import { FIGURE_RIGHTS_ATTESTATION_VERSION } from "../../../lib/figure-capture";

const paper = {
    title: "Example",
    authors: [],
    paperId: "1",
    idName: "pmcid",
    primarySource: "NIH",
    source: "nih",
    paper: [],
    access: {
        canSendToAI: false,
        canPersistContent: false,
        policyReason: "Restricted",
    },
};

const requestWithForm = (form: FormData) => {
    const request = new Request("http://localhost/api/aichat/figure", {
        method: "POST",
        body: form,
    }) as any;
    request.user = { _id: { toString: () => "user-1" } };
    return request;
};

const uploadedFigureForm = (
    captureMethod = "upload",
    rightsAttestation = FIGURE_RIGHTS_ATTESTATION_VERSION,
) => {
    const form = new FormData();
    form.set("database", "nih");
    form.set("paperId", "1");
    form.set("captureMethod", captureMethod);
    form.set("rightsAttestation", rightsAttestation);
    form.set(
        "image",
        new File([new Uint8Array([1, 2, 3])], "figure.png", {
            type: "image/png",
        }),
    );
    return form;
};

describe("figure analysis route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolvePlan.mockReturnValue("pro");
        mocks.consumeQuota.mockResolvedValue({
            allowed: true,
            limit: 100,
            used: 1,
            remaining: 99,
        });
        mocks.refundQuota.mockResolvedValue(undefined);
        mocks.loadCachedPaperBySource.mockResolvedValue({ value: paper });
        mocks.validateFigureBytes.mockReturnValue({
            bytes: new Uint8Array([1, 2, 3]),
            mimeType: "image/png",
        });
        mocks.respondToFigure.mockResolvedValue(
            "## What the figure shows\nA result.",
        );
        mocks.findSavedPaperForUser.mockResolvedValue({ _id: "saved-1" });
        mocks.messageCreate.mockResolvedValue([
            {},
            {
                _id: "answer-1",
                message: "## What the figure shows\nA result.",
                createdAt: new Date("2026-01-01"),
            },
        ]);
    });

    it("restricts figure analysis to Pro users", async () => {
        mocks.resolvePlan.mockReturnValue("free");
        const response = await POST(requestWithForm(new FormData()));
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            code: "PRO_REQUIRED",
        });
        expect(mocks.consumeQuota).not.toHaveBeenCalled();
    });

    it.each(["upload", "paste", "screen_capture", "page_region"])(
        "accepts a transient %s image and consumes one chat credit",
        async (captureMethod) => {
            const response = await POST(
                requestWithForm(uploadedFigureForm(captureMethod)),
            );
            expect(response.status).toBe(200);
            expect(mocks.consumeQuota).toHaveBeenCalledWith(
                expect.objectContaining({ feature: "chat", plan: "pro" }),
            );
            expect(mocks.respondToFigure).toHaveBeenCalledWith(
                expect.objectContaining({
                    imageDataUrl: "data:image/png;base64,test",
                    usageContext: expect.objectContaining({
                        metadata: expect.objectContaining({
                            captureMethod,
                            rightsAttestationVersion:
                                FIGURE_RIGHTS_ATTESTATION_VERSION,
                        }),
                    }),
                }),
            );
            expect(mocks.messageCreate).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        sender: "user",
                        message: expect.stringContaining("uploaded figure"),
                    }),
                    expect.objectContaining({
                        sender: "ai",
                        message: expect.stringContaining(
                            "What the figure shows",
                        ),
                    }),
                ]),
            );
        },
    );

    it("requires rights confirmation for user-supplied images", async () => {
        const response = await POST(
            requestWithForm(uploadedFigureForm("upload", "")),
        );
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            code: "RIGHTS_CONFIRMATION_REQUIRED",
        });
        expect(mocks.validateFigureBytes).not.toHaveBeenCalled();
        expect(mocks.consumeQuota).not.toHaveBeenCalled();
    });

    it("rejects unrecognized capture methods", async () => {
        const response = await POST(
            requestWithForm(uploadedFigureForm("remote_url")),
        );
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            code: "INVALID_CAPTURE_METHOD",
        });
        expect(mocks.validateFigureBytes).not.toHaveBeenCalled();
    });

    it("refunds the chat credit when vision processing fails", async () => {
        mocks.respondToFigure.mockRejectedValue(new Error("provider timeout"));
        const response = await POST(requestWithForm(uploadedFigureForm()));
        expect(response.status).toBe(500);
        expect(mocks.refundQuota).toHaveBeenCalledWith({
            plan: "pro",
            feature: "chat",
            identity: "user-1",
        });
    });
});
