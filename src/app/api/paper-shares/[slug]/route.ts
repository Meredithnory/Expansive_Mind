import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "../../authMiddleware";
import { consumeRateLimit } from "../../../lib/rate-limit";
import { isValidShareSlug } from "../../../lib/share-slug";
import { buildPaperPath } from "../../../lib/paper-sources";
import PaperShare from "../../../models/PaperShare";

export const GET = withAuth(
    async (request: NextRequest) => {
        const slug = request.nextUrl.pathname.split("/").filter(Boolean).at(-1) || "";
        if (!isValidShareSlug(slug)) {
            return NextResponse.json(
                { error: "This shared paper link is invalid." },
                { status: 400 },
            );
        }

        const rateLimit = await consumeRateLimit({
            scope: "paper-share-read",
            identity: request.user._id.toString(),
            limit: 60,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many requests. Please try again shortly." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const share = await PaperShare.findOne({ slug }).lean<{
            ownerName: string;
            database: "nih" | "springer" | "scholar";
            paperId: string;
            idName: string;
            title: string;
            authors: string[];
            sourceLabel: string;
            canonicalUrl: string;
            publicationDate: string;
            highlights: Array<{
                excerpt: string;
                citation: {
                    sectionTitle: string;
                    startLine: number;
                    endLine: number;
                    lines: string[];
                };
                createdAt?: Date;
            }>;
            updatedAt: Date;
        } | null>();

        if (!share) {
            return NextResponse.json(
                { error: "This shared paper is no longer available." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                share: {
                    ownerName: share.ownerName,
                    title: share.title,
                    authors: share.authors || [],
                    sourceLabel: share.sourceLabel || "",
                    canonicalUrl: share.canonicalUrl || "",
                    publicationDate: share.publicationDate || "",
                    paperPath: buildPaperPath(
                        share.database,
                        share.paperId,
                        share.idName,
                    ),
                    highlights: (share.highlights || []).map((highlight) => ({
                        excerpt: highlight.excerpt,
                        citation: highlight.citation,
                        createdAt: highlight.createdAt?.toISOString(),
                    })),
                    updatedAt: share.updatedAt.toISOString(),
                },
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    },
);
