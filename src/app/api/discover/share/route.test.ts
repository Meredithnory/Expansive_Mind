import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    generateShareSlug: vi.fn(() => "shareSlug12ab"),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../authMiddleware", () => ({
    withAuth: (handler: unknown) => handler,
}));
vi.mock("../../../lib/request-security", () => ({
    hasValidMutationOrigin: () => true,
}));
vi.mock("../../../lib/share-slug", () => ({
    generateShareSlug: mocks.generateShareSlug,
}));
vi.mock("../../../models/SavedDiscovery", () => ({
    default: {
        findOne: mocks.findOne,
    },
}));

import { POST } from "./route";
import { SHARE_LOCKED_ERROR } from "../claim-ledger";
import type { OpportunityReport } from "../report-types";

const DISCOVERY_ID = "64a1b2c3d4e5f6a7b8c9d0e1";

const completeReport: OpportunityReport = {
    sections: {
        stateOfScience: "Events fell.",
        gaps: [
            {
                title: "Durability unknown",
                description: "No long follow-up.",
                whyItMatters: "Chronic use.",
                citations: [1],
                confidence: "suggested",
            },
        ],
        problems: [],
        venturePotential: [],
        couldNotVerify: [],
        projectSeeds: [],
    },
};

function discoveryDoc(overrides: Record<string, unknown> = {}) {
    return {
        report: completeReport,
        papers: [
            {
                index: 1,
                paperId: "10.1/one",
                href: "/paperchatbot/springer/10.1/one",
                doi: "10.1/one",
            },
        ],
        extractions: [
            {
                index: 1,
                supportingExcerpt: "Events fell by 12% in the treatment arm.",
            },
        ],
        shareSlug: undefined,
        save: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function requestWithUser(id: string) {
    return {
        user: { _id: { toString: () => "user-1" } },
        json: async () => ({ id }),
    } as never;
}

describe("POST /api/discover/share", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates a slug when the claim ledger is complete", async () => {
        const doc = discoveryDoc();
        mocks.findOne.mockResolvedValue(doc);

        const response = await POST(requestWithUser(DISCOVERY_ID));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.slug).toBe("shareSlug12ab");
        expect(doc.save).toHaveBeenCalled();
    });

    it("rejects share when a claim has no excerpt", async () => {
        mocks.findOne.mockResolvedValue(
            discoveryDoc({
                extractions: [{ index: 1 }],
            }),
        );

        const response = await POST(requestWithUser(DISCOVERY_ID));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe(SHARE_LOCKED_ERROR);
        expect(body.code).toBe("CLAIM_LEDGER_INCOMPLETE");
        expect(mocks.generateShareSlug).not.toHaveBeenCalled();
    });

    it("rejects share when the stored report is missing", async () => {
        mocks.findOne.mockResolvedValue(discoveryDoc({ report: undefined }));

        const response = await POST(requestWithUser(DISCOVERY_ID));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.code).toBe("CLAIM_LEDGER_INCOMPLETE");
        expect(body.reason).toBe("missing_report");
    });

    it("returns an existing slug only when the ledger is still complete", async () => {
        mocks.findOne.mockResolvedValue(
            discoveryDoc({
                shareSlug: "alreadyShared1",
            }),
        );

        const response = await POST(requestWithUser(DISCOVERY_ID));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.slug).toBe("alreadyShared1");
        expect(mocks.generateShareSlug).not.toHaveBeenCalled();
    });
});
