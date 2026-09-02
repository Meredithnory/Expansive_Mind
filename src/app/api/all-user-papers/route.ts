import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../authMiddleware";
import { getNIHPaperResults } from "../search/utils";
import { getSpringerPaperMetadata, getScholarPaperMetadata } from "../paper/utils";
import { getSourceByLabel, PAPER_SOURCES } from "../../lib/paper-sources";
import { findAllSavedPapersForUser } from "../../lib/saved-paper-utils";
import { evaluateContentAccess } from "../../lib/content-access-policy";
import { abstractToText } from "../../lib/abstract-text";

const toDisplayText = (value: unknown, fallback = "") => {
    const text = abstractToText(
        value as string | string[] | Record<string, unknown> | null | undefined,
    ).trim();
    return text || fallback;
};

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const allSaved = await findAllSavedPapersForUser(req.user._id);

        const nihSaved = allSaved.filter(
            (saved) =>
                getSourceByLabel(saved.primarySource)?.database ===
                PAPER_SOURCES.nih.database,
        );
        const springerSaved = allSaved.filter(
            (saved) =>
                getSourceByLabel(saved.primarySource)?.database ===
                PAPER_SOURCES.springer.database,
        );
        const scholarSaved = allSaved.filter(
            (saved) =>
                getSourceByLabel(saved.primarySource)?.database ===
                PAPER_SOURCES.scholar.database,
        );

        const nihIds = nihSaved.map((saved) => saved.paperId);
        const springerIds = springerSaved.map((saved) => saved.paperId);
        const scholarIds = scholarSaved.map((saved) => saved.paperId);

        const [nihResults, springerResults, scholarResults] = await Promise.all([
            nihIds.length > 0
                ? getNIHPaperResults(
                      nihIds.map((id) => ({ id, matchTier: "title" as const })),
                  )
                : Promise.resolve([]),
            getSpringerPaperMetadata(springerIds),
            getScholarPaperMetadata(scholarIds),
        ]);

        const nihMap = new Map(
            nihResults.map((paper: any) => [paper.pmcid, paper]),
        );
        const springerMap = new Map(
            springerResults.map((paper: any) => [paper.paperId, paper]),
        );
        const scholarMap = new Map(
            scholarResults.map((paper: any) => [paper.paperId, paper]),
        );

        const formattedPapers = allSaved
            .map((saved) => {
                const sourceConfig = getSourceByLabel(saved.primarySource);
                if (!sourceConfig) return null;

                if (sourceConfig.database === PAPER_SOURCES.nih.database) {
                    const paper = nihMap.get(saved.paperId);
                    if (!paper) return null;
                    const canonicalUrl = `https://pmc.ncbi.nlm.nih.gov/articles/PMC${saved.paperId}/`;

                    return {
                        paperId: saved.paperId,
                        idName: saved.idName,
                        primarySource: saved.primarySource,
                        database: sourceConfig.database,
                        title: toDisplayText(paper.title, "Untitled"),
                        authors: Array.isArray(paper.authors)
                            ? paper.authors.join(", ")
                            : "",
                        description: toDisplayText(paper.abstract),
                        canonicalUrl,
                        accessStatus: "check",
                        canSendToAI: null,
                    };
                }

                if (sourceConfig.database === PAPER_SOURCES.springer.database) {
                    const paper = springerMap.get(saved.paperId);
                    if (!paper) return null;
                    const title = toDisplayText(paper.title, "Untitled");
                    const access = evaluateContentAccess({
                        source: "springer",
                        rawLicense: paper.rawLicense,
                        licenseUrl: paper.licenseUrl,
                        attribution: {
                            title,
                            authors: paper.authors || [],
                            sourceLabel: saved.primarySource,
                            canonicalUrl: paper.canonicalUrl,
                            paperId: saved.paperId,
                            idName: saved.idName,
                            doi: saved.paperId,
                        },
                    });

                    return {
                        paperId: saved.paperId,
                        idName: saved.idName,
                        primarySource: saved.primarySource,
                        database: sourceConfig.database,
                        title,
                        authors: Array.isArray(paper.authors)
                            ? paper.authors.join(", ")
                            : "",
                        description: toDisplayText(paper.abstract),
                        canonicalUrl: paper.canonicalUrl,
                        accessStatus: access.canSendToAI
                            ? "available"
                            : "restricted",
                        canSendToAI: access.canSendToAI,
                    };
                }

                if (sourceConfig.database === PAPER_SOURCES.scholar.database) {
                    const paper = scholarMap.get(saved.paperId);
                    if (!paper) return null;

                    return {
                        paperId: saved.paperId,
                        idName: saved.idName,
                        primarySource: saved.primarySource,
                        database: sourceConfig.database,
                        title: toDisplayText(paper.title, "Untitled"),
                        authors: Array.isArray(paper.authors)
                            ? paper.authors.join(", ")
                            : "",
                        description: toDisplayText(paper.abstract),
                        canonicalUrl: paper.canonicalUrl,
                        accessStatus: "available",
                        canSendToAI: true,
                        contentLabel: "Search snippet",
                    };
                }

                return null;
            })
            .filter(Boolean);

        return NextResponse.json(
            { papers: formattedPapers },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch {
        console.error("Saved papers request failed");
        return NextResponse.json(
            { error: "Unable to load saved papers." },
            { status: 500 }
        );
    }
});
