import "server-only";
import connectDB from "../db/connectDB";
import GuestDiscovery from "../models/GuestDiscovery";
import { hashQuotaIdentity } from "./quota-identity";

const GUEST_DISCOVERY_TTL_MS = 90 * 24 * 60 * 60 * 1_000;
const BRIEF_MAX = 40_000;

export async function recordGuestDiscovery(input: {
    identity: string;
    question: string;
    brief: string;
    papers?: Array<{ title?: string }>;
    papersUsed?: number;
    correctedQuery?: string;
}) {
    await connectDB();
    const paperTitles = (input.papers || [])
        .map((paper) =>
            typeof paper.title === "string" ? paper.title.trim() : "",
        )
        .filter(Boolean)
        .slice(0, 12);
    const brief =
        input.brief.length > BRIEF_MAX
            ? `${input.brief.slice(0, BRIEF_MAX - 1)}…`
            : input.brief;

    await GuestDiscovery.create({
        identityHash: hashQuotaIdentity(input.identity),
        question: input.question.slice(0, 2_000),
        brief,
        paperTitles,
        papersUsed: input.papersUsed ?? paperTitles.length,
        ...(input.correctedQuery
            ? { correctedQuery: input.correctedQuery.slice(0, 2_000) }
            : {}),
        expiresAt: new Date(Date.now() + GUEST_DISCOVERY_TTL_MS),
    });
}

export async function listGuestDiscoveries(limit = 40) {
    await connectDB();
    const rows = await GuestDiscovery.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select({
            identityHash: 1,
            question: 1,
            brief: 1,
            paperTitles: 1,
            papersUsed: 1,
            correctedQuery: 1,
            createdAt: 1,
        })
        .lean<
            Array<{
                _id: { toString(): string };
                identityHash: string;
                question: string;
                brief: string;
                paperTitles?: string[];
                papersUsed: number;
                correctedQuery?: string;
                createdAt?: Date;
            }>
        >();

    return rows.map((row) => ({
        id: row._id.toString(),
        fingerprint: `${row.identityHash.slice(0, 8)}…`,
        question: row.question,
        briefPreview:
            row.brief.length > 280
                ? `${row.brief.slice(0, 279).trim()}…`
                : row.brief,
        paperTitles: row.paperTitles ?? [],
        papersUsed: row.papersUsed,
        correctedQuery: row.correctedQuery || null,
        createdAt: row.createdAt?.toISOString?.() ?? null,
    }));
}
