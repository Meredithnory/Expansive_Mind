import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "../authMiddleware";
import PaperBrief from "../../models/PaperBrief";
import {
    getSourceByDatabase,
    normalizeStoredPaperId,
    type SourceDatabase,
} from "../../lib/paper-sources";
import { loadCachedPaperBySource } from "../paper/load-paper";
import { consumeRateLimit } from "../../lib/rate-limit";
import { hasValidMutationOrigin } from "../../lib/request-security";
import {
    consumeQuota,
    refundQuota,
    resolvePlan,
    type Plan,
} from "../../lib/entitlements";
import { isAdminUser } from "../../lib/admin";
import { generateShareSlug } from "../../lib/share-slug";
import { synthesizePaperBrief } from "./synthesize-brief";

export const maxDuration = 60;

function parsePaperRef(input: {
    database?: unknown;
    paperId?: unknown;
    idName?: unknown;
}) {
    const database = typeof input.database === "string" ? input.database : "";
    const paperId =
        typeof input.paperId === "string" ? input.paperId.trim() : "";
    const sourceConfig = getSourceByDatabase(database);
    const idName =
        typeof input.idName === "string" && input.idName.trim()
            ? input.idName.trim()
            : sourceConfig?.defaultIdName;
    if (!sourceConfig || !paperId || paperId.length > 300 || !idName) {
        return null;
    }
    return { database: database as SourceDatabase, paperId, idName };
}

// Returns the caller's existing brief for a paper, if one exists.
export const GET = withAuth(async (request: NextRequest) => {
    try {
        const { searchParams } = request.nextUrl;
        const ref = parsePaperRef({
            database: searchParams.get("database"),
            paperId: searchParams.get("paperId"),
            idName: searchParams.get("idName"),
        });
        if (!ref) {
            return NextResponse.json(
                { error: "A valid paper reference is required." },
                { status: 400 },
            );
        }

        const existing = await PaperBrief.findOne({
            userID: request.user._id,
            database: ref.database,
            paperId: normalizeStoredPaperId(ref.paperId),
        }).lean<{ brief: string; slug: string; updatedAt: Date } | null>();

        return NextResponse.json(
            {
                brief: existing
                    ? {
                          brief: existing.brief,
                          slug: existing.slug,
                          updatedAt: existing.updatedAt,
                      }
                    : null,
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        console.error("Brief lookup failed", error);
        return NextResponse.json(
            { error: "Unable to load the brief." },
            { status: 500 },
        );
    }
});

// Generates (or regenerates) a shareable brief for a paper.
export const POST = withAuth(async (request: NextRequest) => {
    let reservation: { plan: Plan; identity: string } | null = null;
    try {
        if (!hasValidMutationOrigin(request)) {
            return NextResponse.json(
                { error: "Invalid origin." },
                { status: 403 },
            );
        }

        const data = await request.json();
        const ref = parsePaperRef(data);
        if (!ref) {
            return NextResponse.json(
                { error: "A valid paper reference is required." },
                { status: 400 },
            );
        }

        const userID = request.user._id;
        const rateLimit = await consumeRateLimit({
            scope: "brief",
            identity: userID.toString(),
            limit: 5,
            windowMs: 10 * 60 * 1_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many brief requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const plan = resolvePlan(request.user);
        const isAdmin = isAdminUser(request.user);
        const quota = await consumeQuota({
            plan,
            feature: "chat",
            identity: userID.toString(),
            userID: userID.toString(),
            unlimited: isAdmin,
        });
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error:
                        plan === "free"
                            ? "Free AI question limit reached. Upgrade to Researcher Pro to continue."
                            : "Monthly AI question limit reached.",
                    code: "QUOTA_EXCEEDED",
                    quota,
                },
                { status: 429 },
            );
        }
        reservation = { plan, identity: userID.toString() };

        const normalizedPaperId = normalizeStoredPaperId(ref.paperId);
        const { value: serverPaper } = await loadCachedPaperBySource(
            ref.database,
            normalizedPaperId,
            ref.idName,
        );
        if (!serverPaper) {
            return NextResponse.json(
                { error: "Paper not found." },
                { status: 404 },
            );
        }
        if (
            !serverPaper.access.canSendToAI ||
            !serverPaper.access.canPersistContent
        ) {
            return NextResponse.json(
                { error: serverPaper.access.policyReason },
                { status: 403 },
            );
        }

        const brief = await synthesizePaperBrief(serverPaper, {
            feature: "chat",
            userID: userID.toString(),
        });
        if (!brief) {
            throw new Error("The AI did not return a brief.");
        }
        reservation = null;

        const saved = await PaperBrief.findOneAndUpdate(
            {
                userID,
                database: ref.database,
                paperId: normalizedPaperId,
            },
            {
                $set: {
                    idName: ref.idName,
                    title: serverPaper.title,
                    authors: serverPaper.authors.slice(0, 12),
                    sourceLabel: serverPaper.primarySource || "",
                    canonicalUrl: serverPaper.access.canonicalUrl || "",
                    publicationDate: serverPaper.publicationDate || "",
                    brief,
                },
                $setOnInsert: {
                    userID,
                    database: ref.database,
                    paperId: normalizedPaperId,
                    slug: generateShareSlug(),
                },
            },
            { new: true, upsert: true },
        );

        return NextResponse.json(
            {
                brief: {
                    brief: saved.brief,
                    slug: saved.slug,
                    updatedAt: saved.updatedAt,
                },
                quota,
            },
            {
                status: 200,
                headers: { "Cache-Control": "private, no-store" },
            },
        );
    } catch (error) {
        if (reservation) {
            await refundQuota({
                plan: reservation.plan,
                feature: "chat",
                identity: reservation.identity,
            }).catch((refundError) =>
                console.warn("Brief quota refund failed", refundError),
            );
        }
        console.error("Brief generation failed", error);
        return NextResponse.json(
            { error: "The brief could not be generated. Please try again." },
            { status: 500 },
        );
    }
});
