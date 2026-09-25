import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    connectDB: vi.fn(),
    paperFindOne: vi.fn(),
    discoveryFindOne: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../db/connectDB", () => ({
    default: mocks.connectDB,
}));
vi.mock("../models/PaperBrief", () => ({
    default: { findOne: mocks.paperFindOne },
}));
vi.mock("../models/SavedDiscovery", () => ({
    default: { findOne: mocks.discoveryFindOne },
}));

import { briefPreviewText, findSharedBrief } from "./shared-brief";

const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const SLUG = "shareSlug12ab";

function lean(value: unknown) {
    return { lean: async () => value };
}

describe("findSharedBrief", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.connectDB.mockResolvedValue(undefined);
        mocks.paperFindOne.mockReturnValue(lean(null));
        mocks.discoveryFindOne.mockReturnValue(lean(null));
    });

    it("rejects an invalid slug before opening the database", async () => {
        await expect(findSharedBrief("nope")).resolves.toBeNull();
        expect(mocks.connectDB).not.toHaveBeenCalled();
        expect(mocks.paperFindOne).not.toHaveBeenCalled();
    });

    it("returns a paper brief and its reader path", async () => {
        mocks.paperFindOne.mockReturnValue(
            lean({
                database: "springer",
                paperId: "10.1/one",
                idName: "doi",
                title: "Events fell",
                authors: ["Ada Lovelace"],
                sourceLabel: "Springer Nature",
                canonicalUrl: "https://doi.org/10.1/one",
                publicationDate: "2024",
                brief: "Events fell.",
                createdAt: new Date("2026-09-01T00:00:00.000Z"),
            }),
        );

        const brief = await findSharedBrief(SLUG);

        expect(brief).toMatchObject({
            kind: "paper",
            title: "Events fell",
            chatPath: "/paperchatbot/springer/10.1/one",
            papers: [],
        });
        expect(mocks.discoveryFindOne).not.toHaveBeenCalled();
    });

    it("attaches a claim-ledger quote for a discovery brief", async () => {
        mocks.discoveryFindOne.mockReturnValue(
            lean({
                question: "Why did events fall?",
                brief: "Events fell.",
                report: {
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
                },
                papers: [
                    {
                        index: 1,
                        paperId: "10.1/one",
                        href: "/paperchatbot/springer/10.1/one",
                        doi: "10.1/one",
                        title: "Events fell",
                        sourceLabel: "Springer Nature",
                        authors: ["Ada Lovelace"],
                        date: "2024",
                        licenseUrl: CC_BY,
                        database: "springer",
                    },
                ],
                extractions: [
                    {
                        index: 1,
                        supportingExcerpt:
                            "Events fell by 12% in the treatment arm.",
                    },
                ],
                createdAt: new Date("2026-09-01T00:00:00.000Z"),
            }),
        );

        const brief = await findSharedBrief(SLUG);

        expect(brief?.kind).toBe("discovery");
        expect(brief?.chatPath).toBe("/discover");
        expect(brief?.papers[0]).toEqual({
            title: "Events fell",
            href: "/paperchatbot/springer/10.1/one",
            sourceLabel: "Springer Nature",
            authors: ["Ada Lovelace"],
            date: "2024",
        });
        expect(brief?.claimLedger?.rows[0]).toMatchObject({
            claim: "Durability unknown",
            quote: "Events fell by 12% in the treatment arm.",
            licenseUrl: CC_BY,
            doi: "10.1/one",
        });
    });

    it("omits the ledger when the stored report cannot be parsed", async () => {
        mocks.discoveryFindOne.mockReturnValue(
            lean({
                question: "Why?",
                brief: "Unknown.",
                report: { unused: true },
                papers: [],
                createdAt: new Date("2026-09-01T00:00:00.000Z"),
            }),
        );

        const brief = await findSharedBrief(SLUG);

        expect(brief?.claimLedger).toBeUndefined();
    });

    it("returns null when neither collection has the slug", async () => {
        await expect(findSharedBrief(SLUG)).resolves.toBeNull();
    });
});

describe("briefPreviewText", () => {
    it("strips markdown and truncates on a word boundary", () => {
        expect(
            briefPreviewText("# Heading\n\n**Events** fell — quickly."),
        ).toBe("Events fell — quickly.");
        expect(
            briefPreviewText("alpha beta gamma delta epsilon", 16),
        ).toBe("alpha beta…");
    });
});
