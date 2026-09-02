import mongoose from "mongoose";
import SavedPaper from "../models/SavedPaper";
import {
    normalizeStoredPaperId,
    PAPER_SOURCES,
} from "./paper-sources";

export interface SavedPaperLookup {
    userID: mongoose.Types.ObjectId | string;
    primarySource: string;
    paperId: string;
    idName: string;
}

export function isLegacySavedPaper(doc: {
    pmcid?: string;
    primarySource?: string;
}): boolean {
    return Boolean(doc.pmcid) && !doc.primarySource;
}

function legacyPmcidCandidates(paperId: string): string[] {
    const trimmed = paperId.trim();
    const normalized = normalizeStoredPaperId(trimmed);
    const candidates = new Set([trimmed, normalized, `PMC${normalized}`]);
    return Array.from(candidates).filter(Boolean);
}

export async function migrateLegacySavedPaperById(
    savedPaperId: mongoose.Types.ObjectId | string,
    legacyPmcid: string,
) {
    const paperId = normalizeStoredPaperId(legacyPmcid);

    await SavedPaper.updateOne(
        { _id: savedPaperId },
        {
            $set: {
                primarySource: PAPER_SOURCES.nih.label,
                paperId,
                idName: PAPER_SOURCES.nih.defaultIdName,
            },
            $unset: { pmcid: "" },
        },
    );

    return SavedPaper.findById(savedPaperId);
}

export async function ensureSavedPaperMigrated<
    T extends { _id: mongoose.Types.ObjectId; pmcid?: string; primarySource?: string },
>(doc: T | null): Promise<T | null> {
    if (!doc || !isLegacySavedPaper(doc)) {
        return doc;
    }

    const migrated = await migrateLegacySavedPaperById(doc._id, doc.pmcid!);
    return (migrated as T | null) ?? doc;
}

export async function findSavedPaperForUser(lookup: SavedPaperLookup) {
    const normalizedPaperId = normalizeStoredPaperId(lookup.paperId);

    const currentFormat = await SavedPaper.findOne({
        userID: lookup.userID,
        primarySource: lookup.primarySource,
        paperId: normalizedPaperId,
        idName: lookup.idName,
    });

    if (currentFormat) {
        return currentFormat;
    }

    const isNihLookup =
        lookup.primarySource === PAPER_SOURCES.nih.label &&
        lookup.idName === PAPER_SOURCES.nih.defaultIdName;

    if (!isNihLookup) {
        return null;
    }

    const legacyDoc = await SavedPaper.findOne({
        userID: lookup.userID,
        pmcid: { $in: legacyPmcidCandidates(lookup.paperId) },
        primarySource: { $exists: false },
    });

    return ensureSavedPaperMigrated(legacyDoc);
}

export async function findAllSavedPapersForUser(
    userID: mongoose.Types.ObjectId | string,
) {
    const allSaved = await SavedPaper.find({ userID }).sort({ createdAt: 1 });
    return Promise.all(allSaved.map((doc) => ensureSavedPaperMigrated(doc)));
}
