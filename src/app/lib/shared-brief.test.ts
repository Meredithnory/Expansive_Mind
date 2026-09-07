import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    connect: vi.fn(), paper: vi.fn(), discovery: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../db/connectDB", () => ({ default: mocks.connect }));
vi.mock("../models/PaperBrief", () => ({ default: { findOne: () => ({ lean: mocks.paper }) } }));
vi.mock("../models/SavedDiscovery", () => ({ default: { findOne: () => ({ lean: mocks.discovery }) } }));
import { findSharedBrief } from "./shared-brief";

function discovery() {
    return {
        question: "Research question", brief: "Report", createdAt: new Date(),
        report: { claimEvidence: [{ rowId: "gap-1-p1", claim: "Gap\n\nUnknown", quote: "Source excerpt." }], sections: {
            stateOfScience: "Evidence [Paper 1]",
            gaps: [{ title: "Gap", description: "Unknown", citations: [1] }],
        } },
        papers: [{ index: 1, title: "Paper", doi: "10.1234/example",
            href: "/paperchatbot/springer/10.1234/example", database: "springer",
            licenseUrl: "https://creativecommons.org/licenses/by/4.0/" }],
        extractions: [{ index: 1, supportingExcerpt: "Source excerpt." }],
    };
}

describe("public discovery brief evidence gate", () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.paper.mockResolvedValue(null); });
    it("returns a complete ledger for an eligible public brief", async () => {
        mocks.discovery.mockResolvedValue(discovery());
        const result = await findSharedBrief("sharedBrief123");
        expect(result?.claimLedger?.rows[0].quote).toBe("Source excerpt.");
        expect(result?.title).toBe("Research question");
    });
    it.each(["report", "quote", "license", "citation", "mapping"])("withholds an existing link with missing %s", async (missing) => {
        const value = discovery();
        if (missing === "report") Object.assign(value, { report: undefined });
        if (missing === "mapping") value.report.claimEvidence = [];
        if (missing === "quote") value.extractions = [];
        if (missing === "license") value.papers[0].licenseUrl = "";
        if (missing === "citation") value.report.sections.gaps[0].citations = [1, 99];
        mocks.discovery.mockResolvedValue(value);
        expect(await findSharedBrief("sharedBrief123")).toBeNull();
    });
    it("rejects invalid slugs before database access", async () => {
        expect(await findSharedBrief("x")).toBeNull();
        expect(mocks.connect).not.toHaveBeenCalled();
    });
});
