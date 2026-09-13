import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ agent: vi.fn(), retrieve: vi.fn(), build: vi.fn(), quota: vi.fn(), cache: vi.fn(), save: vi.fn() }));
vi.mock("../authMiddleware", () => ({ withAuth: (handler: unknown) => handler, withOptionalAuth: (handler: unknown) => handler }));
vi.mock("../../lib/rate-limit", () => ({ consumeRateLimit: async () => ({ allowed: true }), requestIp: () => "test-ip" }));
vi.mock("../../lib/request-security", () => ({ hasValidMutationOrigin: () => true }));
vi.mock("../../models/SavedDiscovery", () => ({ default: { create: mocks.save } }));
vi.mock("./agent", () => ({ runDiscoverAgent: mocks.agent, DiscoverAgentError: class extends Error { status = 400; } }));
vi.mock("./assess-query", () => ({ UNCLEAR_QUESTION_ERROR: "Unclear" }));
vi.mock("../../lib/query-quality", () => ({ looksLikeUnclearResearchQuestion: () => false }));
vi.mock("../../lib/entitlements", () => ({ consumeQuota: mocks.quota, getQuotaSnapshot: vi.fn(), refundQuota: vi.fn(), resolvePlan: () => "guest" }));
vi.mock("../../lib/provider-cache", () => ({ cached: mocks.cache, getCachedValue: vi.fn(), setCachedValue: vi.fn() }));
vi.mock("../../lib/usage-meter", () => ({ deferUsageRecording: vi.fn() }));
vi.mock("../../lib/admin", () => ({ isAdminUser: () => false }));
vi.mock("./founder-diligence", () => ({ retrieveFounderSources: mocks.retrieve, buildFounderReport: mocks.build }));
import { POST } from "./route";
import { parseFounderReport } from "../../lib/founder-report";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.quota.mockResolvedValue({ allowed: true });
    mocks.agent.mockResolvedValue({ question: "assay", brief: "Scientific report", papers: [], extractions: [], meta: {} });
    mocks.cache.mockImplementation(async ({ load }) => ({ value: await load(), cacheHit: false }));
    mocks.retrieve.mockResolvedValue({ sources: [], limitations: [] });
    mocks.build.mockResolvedValue(parseFounderReport({ version: 1, scope: "Unspecified", sources: [], areas: [], options: [] }));
});
const request = (body: unknown) => new NextRequest("http://localhost:3000/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
describe("one-question discovery workflow", () => {
    it("includes science and founder analysis with only a question, regardless of legacy mode", async () => {
        for (const body of [{ question: "assay" }, { question: "assay", mode: "research" }]) {
            const response = await POST(request(body));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.report.founder).toBeDefined();
            expect(data.brief).toContain("Scientific report");
            expect(data.brief).toContain("Founder diligence");
        }
        expect(mocks.retrieve).toHaveBeenCalledTimes(2);
        expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({ scope: "" }));
    });
    it("passes optional context without changing the research question", async () => {
        await POST(request({ question: "assay", founderScope: " US labs, idea stage " }));
        expect(mocks.agent).toHaveBeenCalledWith("assay", expect.anything());
        expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({ scope: "US labs, idea stage" }));
    });
    it("rejects oversized context before consuming quota", async () => {
        const response = await POST(request({ question: "assay", founderScope: "x".repeat(501) }));
        expect(response.status).toBe(400);
        expect(mocks.quota).not.toHaveBeenCalled();
    });
    it("retains science and reports commercial retrieval failure without inventing evidence", async () => {
        mocks.retrieve.mockRejectedValue(new Error("provider down"));
        const response = await POST(request({ question: "assay" }));
        expect(response.status).toBe(200);
        expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({ commercial: { sources: [], limitations: ["Commercial retrieval failed. Commercial conclusions remain unverified."] } }));
    });
});
