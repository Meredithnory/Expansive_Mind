import "server-only";
import connectDB from "../db/connectDB";
import PaperBrief from "../models/PaperBrief";
import SavedDiscovery from "../models/SavedDiscovery";
import { isValidShareSlug } from "./share-slug";
import { buildPaperPath, type SourceDatabase } from "./paper-sources";

export interface SharedBriefPaperRef {
    title: string;
    href: string;
    sourceLabel: string;
    authors: string[];
    date: string;
}

export interface SharedBrief {
    kind: "paper" | "discovery";
    title: string;
    brief: string;
    authors: string[];
    sourceLabel: string;
    canonicalUrl: string;
    publicationDate: string;
    chatPath: string;
    papers: SharedBriefPaperRef[];
    createdAt: Date;
}

export async function findSharedBrief(
    slug: string,
): Promise<SharedBrief | null> {
    if (!isValidShareSlug(slug)) return null;
    await connectDB();

    const paperBrief = await PaperBrief.findOne({ slug }).lean<{
        database: SourceDatabase;
        paperId: string;
        idName: string;
        title: string;
        authors: string[];
        sourceLabel: string;
        canonicalUrl: string;
        publicationDate: string;
        brief: string;
        createdAt: Date;
    } | null>();
    if (paperBrief) {
        return {
            kind: "paper",
            title: paperBrief.title,
            brief: paperBrief.brief,
            authors: paperBrief.authors || [],
            sourceLabel: paperBrief.sourceLabel || "",
            canonicalUrl: paperBrief.canonicalUrl || "",
            publicationDate: paperBrief.publicationDate || "",
            chatPath: buildPaperPath(
                paperBrief.database,
                paperBrief.paperId,
                paperBrief.idName,
            ),
            papers: [],
            createdAt: paperBrief.createdAt,
        };
    }

    const discovery = await SavedDiscovery.findOne({
        shareSlug: slug,
    }).lean<{
        question: string;
        brief: string;
        papers: Array<{
            title: string;
            href: string;
            sourceLabel: string;
            authors: string[];
            date: string;
        }>;
        createdAt: Date;
    } | null>();
    if (discovery) {
        return {
            kind: "discovery",
            title: discovery.question,
            brief: discovery.brief,
            authors: [],
            sourceLabel: "Evidence synthesis across papers",
            canonicalUrl: "",
            publicationDate: "",
            chatPath: "/discover",
            papers: (discovery.papers || []).map((paper) => ({
                title: paper.title,
                href: paper.href,
                sourceLabel: paper.sourceLabel,
                authors: paper.authors || [],
                date: paper.date || "",
            })),
            createdAt: discovery.createdAt,
        };
    }

    return null;
}

// Plain-text preview of the brief for meta descriptions and OG cards.
export function briefPreviewText(brief: string, limit = 200): string {
    const text = brief
        .replace(/^#+\s.*$/gm, " ")
        .replace(/[*_`>#-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    return `${slice.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit)}…`;
}
